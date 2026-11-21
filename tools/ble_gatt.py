import asyncio, sys
from bleak import BleakClient

ADDR = sys.argv[1]

async def main():
    async with BleakClient(ADDR, timeout=20.0) as c:
        print("Conectado:", c.is_connected)
        for s in c.services:
            print(f"\n[Servicio] {s.uuid}  {s.description}")
            for ch in s.characteristics:
                props = ",".join(ch.properties)
                val = ""
                if "read" in ch.properties:
                    try:
                        raw = await c.read_gatt_char(ch)
                        txt = raw.decode("utf-8", "ignore") if all(32 <= b < 127 for b in raw) and raw else ""
                        val = f" = {raw.hex()}" + (f"  '{txt}'" if txt else "")
                    except Exception as e:
                        val = f" (error lectura: {e.__class__.__name__})"
                print(f"   - {ch.uuid}  [{props}]  {ch.description}{val}")

asyncio.run(main())
