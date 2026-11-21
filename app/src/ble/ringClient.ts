import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  buildFrame, CHAR_CMD_UUID, CHAR_DATA_UUID, CMD, decodeBattery, decodeHistory, decodeLive, decodeName,
  ERROR_CODES, Frame, FrameAssembler, fromBase64, HistoryRecord, LiveReading, MAGIC, MeasureType,
  SERVICE_UUID, timePayload, toBase64,
} from './ycbt';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface RingInfo {
  battery: number | null;
  name: string | null;
}

type FrameListener = (f: Frame) => void;

/**
 * Cliente del anillo. Regla de oro (aprendida en Windows): conectar, hacer la tarea y
 * DESCONECTAR siempre; un anillo conectado deja de anunciarse y nadie más lo encuentra.
 */
export class RingClient {
  private manager = new BleManager();
  private device: Device | null = null;
  private subs: Subscription[] = [];
  private assembler = new FrameAssembler();
  private listeners = new Set<FrameListener>();
  private busy = false;

  async ensurePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10);
    if (apiLevel >= 31) {
      const res = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(res).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const loc = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return loc === PermissionsAndroid.RESULTS.GRANTED;
  }

  async bluetoothOn(): Promise<boolean> {
    return (await this.manager.state()) === 'PoweredOn';
  }

  /** Busca un anillo AIF01 cercano. Devuelve su id (en Android, la dirección MAC). */
  scan(timeoutMs = 15000): Promise<{ id: string; name: string } | null> {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v: { id: string; name: string } | null) => {
        if (done) return;
        done = true;
        this.manager.stopDeviceScan();
        resolve(v);
      };
      this.manager.startDeviceScan(null, { allowDuplicates: false }, (err, dev) => {
        if (err) return finish(null);
        const name = dev?.localName ?? dev?.name ?? '';
        if (dev && name.startsWith('AIF')) finish({ id: dev.id, name });
      });
      setTimeout(() => finish(null), timeoutMs);
    });
  }

  /** Ejecuta una tarea con el anillo conectado y desconecta SIEMPRE al final. */
  async withConnection<T>(deviceId: string, task: () => Promise<T>): Promise<T> {
    if (this.busy) throw new Error('El anillo ya está en uso');
    this.busy = true;
    try {
      await this.connect(deviceId);
      return await task();
    } finally {
      await this.disconnect();
      this.busy = false;
    }
  }

  private async connect(deviceId: string): Promise<void> {
    const dev = await this.manager.connectToDevice(deviceId, { timeout: 15000 });
    await dev.discoverAllServicesAndCharacteristics();
    if (Platform.OS === 'android') {
      try { await dev.requestMTU(185); } catch { /* opcional */ }
    }
    this.device = dev;
    this.assembler.reset();
    for (const uuid of [CHAR_CMD_UUID, CHAR_DATA_UUID]) {
      this.subs.push(
        dev.monitorCharacteristicForService(SERVICE_UUID, uuid, (error, ch) => {
          if (error || !ch?.value) return;
          for (const f of this.assembler.push(fromBase64(ch.value))) this.listeners.forEach((l) => l(f));
        }),
      );
    }
    await sleep(300);
  }

  private async disconnect(): Promise<void> {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    const dev = this.device;
    this.device = null;
    if (dev) {
      try { await this.manager.cancelDeviceConnection(dev.id); } catch { /* ya desconectado */ }
    }
  }

  onFrame(l: FrameListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  async send(cmd: number, payload: ArrayLike<number> = [], waitMs = 800): Promise<void> {
    if (!this.device) throw new Error('Anillo no conectado');
    await this.device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_CMD_UUID, toBase64(buildFrame(cmd, payload)));
    if (waitMs) await sleep(waitMs);
  }

  /** Envía un comando y espera la respuesta con el mismo opcode. */
  async request(cmd: number, payload: ArrayLike<number> = [], timeoutMs = 3000): Promise<Frame> {
    return new Promise<Frame>((resolve, reject) => {
      const off = this.onFrame((f) => {
        if (f.cmd !== cmd) return;
        off();
        clearTimeout(timer);
        if (f.payload.length === 1 && ERROR_CODES[f.payload[0]]) reject(new Error(ERROR_CODES[f.payload[0]]));
        else resolve(f);
      });
      const timer = setTimeout(() => { off(); reject(new Error('El anillo no respondió')); }, timeoutMs);
      this.send(cmd, payload, 0).catch((e) => { off(); clearTimeout(timer); reject(e); });
    });
  }

  // ---------- operaciones de alto nivel (llamar dentro de withConnection) ----------

  async readInfo(): Promise<RingInfo> {
    const info = await this.request(CMD.DEVICE_INFO, MAGIC.DEVICE_INFO).catch(() => null);
    const name = await this.request(CMD.DEVICE_NAME, MAGIC.DEVICE_NAME).catch(() => null);
    return { battery: info ? decodeBattery(info) : null, name: name ? decodeName(name) : null };
  }

  async syncTime(now = new Date()): Promise<void> {
    await this.request(CMD.SET_TIME, timePayload(now));
  }

  /** Ajuste persistente: monitoreo automático + sensores de salud. Necesario para que el LED encienda. */
  async setAutoMonitoring(on: boolean): Promise<void> {
    await this.request(CMD.HEALTH_MONITOR, [on ? 1 : 0]);
  }

  /** Mide en vivo durante `seconds` (o hasta que el anillo avise el fin). Siempre envía "detener". */
  async measure(type: MeasureType, seconds: number, onReading: (r: LiveReading) => void): Promise<void> {
    const off = this.onFrame((f) => {
      const r = decodeLive(f);
      if (r) onReading(r);
    });
    let ended = false;
    const offEnd = this.onFrame((f) => {
      const r = decodeLive(f);
      if (r?.kind === 'end' && r.type === type) ended = true;
    });
    try {
      await this.setAutoMonitoring(true);
      await this.send(CMD.PPG_PRIME, [1, 1]);
      const ack = await this.request(CMD.MEASURE, [1, type]);
      if (ack.payload[0] !== 0) throw new Error('El anillo rechazó esta medición');
      const until = Date.now() + seconds * 1000;
      while (Date.now() < until && !ended) await sleep(500);
    } finally {
      off();
      offEnd();
      await this.send(CMD.MEASURE, [0, type]).catch(() => undefined);
    }
  }

  /** Pide cada historial (solo lectura, nunca borra). Devuelve registros decodificados y tramas crudas. */
  async fetchHistory(perTypeMs = 6000): Promise<{ records: HistoryRecord[]; raw: Frame[] }> {
    const records: HistoryRecord[] = [];
    const raw: Frame[] = [];
    for (const req of [CMD.HIST_HEART, CMD.HIST_BLOOD, CMD.HIST_ALL, CMD.HIST_SPORT, CMD.HIST_SLEEP]) {
      const off = this.onFrame((f) => {
        if (f.cmd >> 8 !== 0x05) return;
        raw.push(f);
        // Los datos llegan con opcode = pedido + 0x0F (convención de Gadgetbridge para YCBT)
        if (f.cmd === req + 0x0f) records.push(...decodeHistory(req, f.payload));
      });
      try {
        await this.send(req, [], perTypeMs);
      } finally {
        off();
      }
    }
    return { records, raw };
  }
}

export const ring = new RingClient();
