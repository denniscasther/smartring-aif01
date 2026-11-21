"""Cliente YCBT para el smart ring AIF01 (app SmartHealth / Yucheng) vía WinRT.

Usa la API Bluetooth de Windows directamente, así funciona aunque Windows ya tenga
una conexión abierta con el anillo, y la libera al terminar.

Uso:
    python tools/ring.py info
    python tools/ring.py medir <tipo> [segundos]     tipo: 0 pulso, 1 presión, 2 SpO2, 4 temperatura
    python tools/ring.py tipos 1,3,4 [segundos]      prueba varios tipos en una conexión
    python tools/ring.py config                      sincroniza hora + activa monitoreo automático
    python tools/ring.py hist                        pide historial (solo lectura)
    python tools/ring.py apagar                      detiene mediciones y desactiva sensores

Dirección: variable de entorno RING_ADDR o archivo private/ring_addr.txt (formato AA:BB:CC:DD:EE:FF).
NUNCA se envían los comandos 0x0540-0x054E (borrar historial).
"""
import asyncio, datetime, os, sys, time, uuid
from pathlib import Path
from winrt.windows.devices.bluetooth import BluetoothLEDevice, BluetoothCacheMode
from winrt.windows.devices.bluetooth.genericattributeprofile import (
    GattWriteOption, GattCommunicationStatus,
    GattClientCharacteristicConfigurationDescriptorValue as CCCD)
from winrt.windows.storage.streams import DataWriter, DataReader

_addr_file = Path(__file__).resolve().parent.parent / "private" / "ring_addr.txt"
_addr = os.environ.get("RING_ADDR") or (_addr_file.read_text().strip() if _addr_file.exists() else "")
if not _addr:
    raise SystemExit("Define RING_ADDR o crea private/ring_addr.txt con la dirección del anillo (usa tools/ble_scan.py).")
ADDR = int(_addr.replace(":", ""), 16)
SVC = uuid.UUID("be940000-7333-be46-b7ae-689e71722bd5")
C1 = uuid.UUID("be940001-7333-be46-b7ae-689e71722bd5")  # comandos + respuestas
C3 = uuid.UUID("be940003-7333-be46-b7ae-689e71722bd5")  # datos en vivo
PRIVATE = Path(__file__).resolve().parent.parent / "private"
ERR = {0xFB: "comando no soportado", 0xFC: "clave no soportada", 0xFD: "error de largo",
       0xFE: "error de datos", 0xFF: "error CRC"}
TIPO_NOMBRE = {0: "pulso", 1: "presión", 2: "SpO2", 4: "temperatura"}
HIST = [("pasos", 0x0502), ("sueño", 0x0504), ("pulso", 0x0506),
        ("presión", 0x0508), ("combinado", 0x0509)]
t0 = time.time()


# ---------- protocolo ----------
def crc16_ycbt(data: bytes) -> int:
    s = 0xFFFF
    for x in data:
        a = ((s << 8) & 0xFF00) | ((s >> 8) & 0xFF)
        b = (a ^ x) & 0xFFFF
        c = b ^ ((b & 0xFF) >> 4)
        d = (c ^ (c << 12)) & 0xFFFF
        s = (d ^ ((d & 0xFF) << 5)) & 0xFFFF
    return s


def frame(cmd: int, payload: bytes = b"") -> bytes:
    assert not (0x0540 <= cmd <= 0x054E), "comando de borrado bloqueado"
    n = len(payload) + 6
    body = bytes([cmd >> 8, cmd & 0xFF, n & 0xFF, n >> 8]) + payload
    c = crc16_ycbt(body)
    return body + bytes([c & 0xFF, c >> 8])


# ---------- recepción ----------
class Receiver:
    def __init__(self, rawlog=None):
        self.buf = bytearray()
        self.last060d = None
        self.rawlog = rawlog

    def feed(self, data: bytes):
        self.buf += data
        while len(self.buf) >= 4:
            total = self.buf[2] | (self.buf[3] << 8)
            if total < 6 or total > 4096:
                print("paquete raro:", self.buf.hex()); self.buf.clear(); return
            if len(self.buf) < total:
                return
            f = bytes(self.buf[:total]); del self.buf[:total]
            self.handle((f[0] << 8) | f[1], f[4:total - 2])

    def handle(self, cmd: int, p: bytes):
        ts = f"[{time.time() - t0:6.1f}s]"
        if self.rawlog:
            self.rawlog.write(f"{datetime.datetime.now().isoformat()}\t{cmd:04X}\t{p.hex()}\n")
            self.rawlog.flush()
        if cmd == 0x060D:
            nz = {i: b for i, b in enumerate(p) if b and i != 21}
            if nz != self.last060d:
                print(f"{ts}   estado 0x060D: {nz}", flush=True); self.last060d = nz
            return
        if len(p) == 1 and p[0] in ERR:
            print(f"{ts} 0x{cmd:04X} ERROR: {ERR[p[0]]}", flush=True); return
        if cmd == 0x0601: print(f"{ts} ❤️  pulso {p[0]} lpm", flush=True); return
        if cmd == 0x0602: print(f"{ts} 🩸 SpO2 {p[0]} %", flush=True); return
        if cmd == 0x0603: print(f"{ts} 🩺 presión {p[0]}/{p[1]} (pulso {p[2]})  [estimada]", flush=True); return
        if cmd == 0x060A and len(p) > 13: print(f"{ts} 🌡️  temperatura {p[12]}.{p[13]} °C", flush=True); return
        if cmd == 0x0200 and len(p) > 5: print(f"{ts} 🔋 batería {p[5]} %", flush=True); return
        if cmd == 0x0203:
            nombre = p.rstrip(bytes(1)).decode(errors="ignore")
            print(f"{ts} nombre: {nombre}", flush=True); return
        if cmd == 0x040E and len(p) >= 2:
            print(f"{ts} fin de medición tipo {p[0]} (estado {p[1]})", flush=True); return
        if (cmd >> 8) == 0x05:
            print(f"{ts} historial 0x{cmd:04X}: {len(p)} bytes {p[:24].hex()}{'…' if len(p) > 24 else ''}", flush=True); return
        if cmd in (0x032F,) and p:
            print(f"{ts} 0x{cmd:04X} {'aceptado' if p[0] == 0 else 'rechazado'}", flush=True); return
        print(f"{ts} 0x{cmd:04X} {p.hex()}", flush=True)


def to_bytes(buf) -> bytes:
    r = DataReader.from_buffer(buf)
    out = bytearray(buf.length)
    r.read_bytes(out)
    return bytes(out)


# ---------- sesión ----------
class Ring:
    async def __aenter__(self):
        self.loop = asyncio.get_running_loop()
        self.dev = await BluetoothLEDevice.from_bluetooth_address_async(ADDR)
        if self.dev is None:
            raise SystemExit("Windows no encuentra el anillo (¿cargando? ¿celular conectado?).")
        print("Estado inicial:", "conectado" if self.dev.connection_status == 1 else "desconectado (conectando…)")
        sr = await self.dev.get_gatt_services_for_uuid_async(SVC, BluetoothCacheMode.UNCACHED)
        if sr.status != GattCommunicationStatus.SUCCESS or not sr.services:
            self.dev.close()
            raise SystemExit(f"No se pudo abrir el servicio YCBT (status {sr.status}). ¿Anillo lejos o cargando?")
        self.svc = sr.services[0]
        self.c1 = (await self.svc.get_characteristics_for_uuid_async(C1, BluetoothCacheMode.UNCACHED)).characteristics[0]
        self.c3 = (await self.svc.get_characteristics_for_uuid_async(C3, BluetoothCacheMode.UNCACHED)).characteristics[0]
        self.rx = Receiver()
        self.tokens = []
        for ch in (self.c1, self.c3):
            tok = ch.add_value_changed(lambda s, a: self.loop.call_soon_threadsafe(self.rx.feed, to_bytes(a.characteristic_value)))
            self.tokens.append((ch, tok))
            await ch.write_client_characteristic_configuration_descriptor_async(CCCD.INDICATE)
        return self

    async def send(self, cmd: int, payload: bytes = b"", wait: float = 1.0):
        w = DataWriter(); w.write_bytes(frame(cmd, payload))
        st = await self.c1.write_value_with_option_async(w.detach_buffer(), GattWriteOption.WRITE_WITH_RESPONSE)
        if st != GattCommunicationStatus.SUCCESS:
            print(f"fallo al escribir 0x{cmd:04X}: {st}")
        await asyncio.sleep(wait)

    async def __aexit__(self, *exc):
        for ch, tok in self.tokens:
            try:
                await ch.write_client_characteristic_configuration_descriptor_async(CCCD.NONE)
                ch.remove_value_changed(tok)
            except Exception:
                pass
        self.svc.close(); self.dev.close()
        await asyncio.sleep(3)
        d = await BluetoothLEDevice.from_bluetooth_address_async(ADDR)
        print("Estado final:", "CONECTADO (apaga/enciende el Bluetooth de la laptop)" if d.connection_status == 1 else "desconectado ✔")
        d.close()


async def stop_all(r: Ring):
    for t in (0, 1, 2, 4):
        await r.send(0x032F, bytes([0, t]), 0.6)


async def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "info"
    async with Ring() as r:
        if mode == "info":
            await r.send(0x0200, b"GC")
            await r.send(0x0203, b"GP")
            await r.send(0x0201, b"GF", 1.5)
        elif mode in ("medir", "tipos"):
            tipos = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [0]
            secs = int(sys.argv[3]) if len(sys.argv) > 3 else 60
            try:
                await r.send(0x0104, b"\x01")
                for t in tipos:
                    print(f"\n== {TIPO_NOMBRE.get(t, f'tipo {t}')} ({secs}s, mano quieta) ==")
                    await r.send(0x030C, b"\x01\x01")
                    await r.send(0x032F, bytes([1, t]))
                    await asyncio.sleep(secs)
                    await r.send(0x032F, bytes([0, t]), 2)
            finally:
                await stop_all(r)
        elif mode == "config":
            n = datetime.datetime.now()
            await r.send(0x0100, bytes([n.year & 0xFF, n.year >> 8, n.month, n.day,
                                        n.hour, n.minute, n.second, n.weekday()]))
            print(f"hora sincronizada: {n:%Y-%m-%d %H:%M:%S}")
            await r.send(0x0104, b"\x01")
            print("monitoreo automático: activado")
        elif mode == "hist":
            PRIVATE.mkdir(exist_ok=True)
            path = PRIVATE / f"historial_{datetime.datetime.now():%Y%m%d_%H%M%S}.tsv"
            r.rx.rawlog = open(path, "w", encoding="utf-8")
            try:
                for name, op in HIST:
                    print(f"\n== historial {name} (0x{op:04X}) ==")
                    await r.send(op, b"", 8)
            finally:
                r.rx.rawlog.close()
            print(f"datos crudos guardados en {path}")
        elif mode == "apagar":
            await stop_all(r)
            await r.send(0x0104, b"\x00")
            print("mediciones detenidas y monitoreo desactivado")
        else:
            print(__doc__)


if __name__ == "__main__":
    asyncio.run(main())
