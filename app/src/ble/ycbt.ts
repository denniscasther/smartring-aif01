/**
 * Protocolo YCBT (Yucheng) verificado contra el anillo AIF01.
 * Funciones puras: sin dependencias de BLE ni React, para poder probarlas aisladas.
 * Ver docs/protocolo-ycbt.md en la raíz del proyecto.
 */

export const SERVICE_UUID = 'be940000-7333-be46-b7ae-689e71722bd5';
export const CHAR_CMD_UUID = 'be940001-7333-be46-b7ae-689e71722bd5'; // escribir comandos + respuestas
export const CHAR_DATA_UUID = 'be940003-7333-be46-b7ae-689e71722bd5'; // datos en vivo

export const CMD = {
  SET_TIME: 0x0100,
  HEALTH_MONITOR: 0x0104,
  DEVICE_INFO: 0x0200,
  SUPPORT_FN: 0x0201,
  DEVICE_NAME: 0x0203,
  PPG_PRIME: 0x030c,
  MEASURE: 0x032f,
  HIST_SPORT: 0x0502,
  HIST_SLEEP: 0x0504,
  HIST_HEART: 0x0506,
  HIST_BLOOD: 0x0508,
  HIST_ALL: 0x0509,
  LIVE_HR: 0x0601,
  LIVE_SPO2: 0x0602,
  LIVE_BP: 0x0603,
  LIVE_TEMP: 0x060a,
  LIVE_STATUS: 0x060d,
  MEASURE_END: 0x040e,
} as const;

/** Prefijos "mágicos" que exige el firmware en algunos GET. */
export const MAGIC = {
  DEVICE_INFO: [0x47, 0x43], // "GC"
  SUPPORT_FN: [0x47, 0x46], // "GF"
  DEVICE_NAME: [0x47, 0x50], // "GP"
} as const;

export const MeasureType = {
  HeartRate: 0,
  BloodPressure: 1,
  SpO2: 2,
  Temperature: 4,
} as const;
export type MeasureType = (typeof MeasureType)[keyof typeof MeasureType];

export const MEASURE_LABEL: Record<MeasureType, string> = {
  [MeasureType.HeartRate]: 'Pulso',
  [MeasureType.BloodPressure]: 'Presión',
  [MeasureType.SpO2]: 'SpO2',
  [MeasureType.Temperature]: 'Temperatura',
};

export const ERROR_CODES: Record<number, string> = {
  0xfb: 'comando no soportado',
  0xfc: 'clave no soportada',
  0xfd: 'error de largo',
  0xfe: 'error de datos',
  0xff: 'error CRC',
};

export function crc16Ycbt(data: Uint8Array): number {
  let s = 0xffff;
  for (const x of data) {
    const a = ((s << 8) & 0xff00) | ((s >> 8) & 0xff);
    const b = (a ^ x) & 0xffff;
    const c = b ^ ((b & 0xff) >> 4);
    const d = (c ^ (c << 12)) & 0xffff;
    s = (d ^ ((d & 0xff) << 5)) & 0xffff;
  }
  return s;
}

/** Comandos de borrado de historial: bloqueados siempre. */
export function isDeleteCommand(cmd: number): boolean {
  return cmd >= 0x0540 && cmd <= 0x054e;
}

export function buildFrame(cmd: number, payload: ArrayLike<number> = []): Uint8Array {
  if (isDeleteCommand(cmd)) throw new Error('Comando de borrado bloqueado');
  const total = payload.length + 6;
  const out = new Uint8Array(total);
  out[0] = (cmd >> 8) & 0xff;
  out[1] = cmd & 0xff;
  out[2] = total & 0xff;
  out[3] = (total >> 8) & 0xff;
  out.set(Array.from(payload), 4);
  const crc = crc16Ycbt(out.subarray(0, total - 2));
  out[total - 2] = crc & 0xff;
  out[total - 1] = (crc >> 8) & 0xff;
  return out;
}

export function timePayload(d: Date): number[] {
  const y = d.getFullYear();
  const weekdayMon0 = (d.getDay() + 6) % 7;
  return [y & 0xff, y >> 8, d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), weekdayMon0];
}

export interface Frame {
  cmd: number;
  payload: Uint8Array;
}

/** Reensambla paquetes que llegan partidos por MTU. */
export class FrameAssembler {
  private buf: number[] = [];

  push(chunk: Uint8Array): Frame[] {
    this.buf.push(...chunk);
    const frames: Frame[] = [];
    while (this.buf.length >= 4) {
      const total = this.buf[2] | (this.buf[3] << 8);
      if (total < 6 || total > 4096) {
        this.buf = [];
        break;
      }
      if (this.buf.length < total) break;
      const f = this.buf.splice(0, total);
      frames.push({ cmd: (f[0] << 8) | f[1], payload: Uint8Array.from(f.slice(4, total - 2)) });
    }
    return frames;
  }

  reset(): void {
    this.buf = [];
  }
}

// ---------- decodificadores ----------

export type LiveReading =
  | { kind: 'hr'; bpm: number }
  | { kind: 'spo2'; percent: number }
  | { kind: 'bp'; systolic: number; diastolic: number; bpm: number }
  | { kind: 'temp'; celsius: number }
  | { kind: 'status'; bpm: number }
  | { kind: 'end'; type: number; state: number };

export function decodeLive(f: Frame): LiveReading | null {
  const p = f.payload;
  switch (f.cmd) {
    case CMD.LIVE_HR:
      return p.length >= 1 && p[0] > 0 ? { kind: 'hr', bpm: p[0] } : null;
    case CMD.LIVE_SPO2:
      return p.length >= 1 && p[0] > 0 ? { kind: 'spo2', percent: p[0] } : null;
    case CMD.LIVE_BP:
      return p.length >= 3 && p[0] > 0 ? { kind: 'bp', systolic: p[0], diastolic: p[1], bpm: p[2] } : null;
    case CMD.LIVE_TEMP:
      return p.length > 13 && p[12] > 0 ? { kind: 'temp', celsius: p[12] + p[13] / 10 } : null;
    case CMD.LIVE_STATUS:
      return p.length >= 1 && p[0] > 0 ? { kind: 'status', bpm: p[0] } : null;
    case CMD.MEASURE_END:
      return p.length >= 2 ? { kind: 'end', type: p[0], state: p[1] } : null;
    default:
      return null;
  }
}

export function decodeBattery(f: Frame): number | null {
  return f.cmd === CMD.DEVICE_INFO && f.payload.length > 5 ? f.payload[5] : null;
}

export function decodeName(f: Frame): string | null {
  if (f.cmd !== CMD.DEVICE_NAME) return null;
  let s = '';
  for (const b of f.payload) if (b >= 32 && b < 127) s += String.fromCharCode(b);
  return s || null;
}

/** Segundos desde 2000-01-01 en hora local del anillo → Date. */
export function ycbtTime(secs: number): Date {
  const base = new Date(2000, 0, 1, 0, 0, 0);
  return new Date(base.getTime() + secs * 1000);
}

function u32(p: Uint8Array, i: number): number {
  return (p[i] | (p[i + 1] << 8) | (p[i + 2] << 16) | (p[i + 3] << 24)) >>> 0;
}
function u16(p: Uint8Array, i: number): number {
  return p[i] | (p[i + 1] << 8);
}

export interface HistoryRecord {
  at: Date;
  kind: 'hr' | 'bp' | 'all' | 'sport';
  values: Record<string, number>;
}

/** Decodifica registros de historial según el tipo pedido (layouts del SDK YCBT; pendiente de validar con datos reales). */
export function decodeHistory(requestCmd: number, p: Uint8Array): HistoryRecord[] {
  const out: HistoryRecord[] = [];
  const add = (stride: number, fn: (i: number) => HistoryRecord | null) => {
    for (let i = 0; i + stride <= p.length; i += stride) {
      const r = fn(i);
      if (r) out.push(r);
    }
  };
  switch (requestCmd) {
    case CMD.HIST_HEART:
      add(6, (i) => (p[i + 5] > 0 && p[i + 5] < 240 ? { at: ycbtTime(u32(p, i)), kind: 'hr', values: { bpm: p[i + 5] } } : null));
      break;
    case CMD.HIST_BLOOD:
      add(8, (i) => ({ at: ycbtTime(u32(p, i)), kind: 'bp', values: { systolic: p[i + 5], diastolic: p[i + 6], bpm: p[i + 7] } }));
      break;
    case CMD.HIST_ALL:
      add(20, (i) => ({
        at: ycbtTime(u32(p, i)),
        kind: 'all',
        values: {
          steps: u16(p, i + 4), bpm: p[i + 6], systolic: p[i + 7], diastolic: p[i + 8],
          spo2: p[i + 9], hrv: p[i + 11], temp: p[i + 13] + p[i + 14] / 100,
        },
      }));
      break;
    case CMD.HIST_SPORT:
      add(14, (i) => ({
        at: ycbtTime(u32(p, i)),
        kind: 'sport',
        values: { steps: u16(p, i + 8), distance: u16(p, i + 10), calories: u16(p, i + 12) },
      }));
      break;
  }
  return out;
}

// ---------- base64 (ble-plx usa base64) ----------
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]) << 18) | (B64.indexOf(clean[i + 1]) << 12) |
      ((B64.indexOf(clean[i + 2]) & 63) << 6) | (B64.indexOf(clean[i + 3]) & 63);
    out.push((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined) out.push((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined) out.push(n & 0xff);
  }
  return Uint8Array.from(out);
}
