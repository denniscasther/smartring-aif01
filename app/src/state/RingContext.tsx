import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ring } from '../ble/ringClient';
import { LiveReading, MeasureType } from '../ble/ycbt';
import { addReading, getSetting, latestByKind, Reading, ReadingKind, saveRawFrames, setSetting } from '../db/database';

export type RingStatus = 'idle' | 'scanning' | 'working' | 'error';

interface RingState {
  status: RingStatus;
  message: string;
  deviceId: string | null;
  deviceName: string | null;
  battery: number | null;
  lastSync: string | null;
  latest: Partial<Record<ReadingKind, Reading>>;
  findRing: () => Promise<void>;
  sync: () => Promise<void>;
  measure: (type: MeasureType, seconds: number, onReading: (r: LiveReading) => void) => Promise<void>;
  setMonitoring: (on: boolean) => Promise<void>;
  refreshLatest: () => Promise<void>;
}

const Ctx = createContext<RingState | null>(null);

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/not connected|disconnected|timed out|timeout/i.test(m)) {
    return 'No se pudo conectar. Acércate al anillo, sácalo del cargador y cierra SmartHealth.';
  }
  return m;
}

export function RingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RingStatus>('idle');
  const [message, setMessage] = useState('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [latest, setLatest] = useState<Partial<Record<ReadingKind, Reading>>>({});

  const refreshLatest = useCallback(async () => {
    const l = await latestByKind();
    setLatest(l);
    if (l.battery) setBattery(l.battery.v1);
  }, []);

  useEffect(() => {
    (async () => {
      setDeviceId(await getSetting('deviceId'));
      setDeviceName(await getSetting('deviceName'));
      setLastSync(await getSetting('lastSync'));
      await refreshLatest();
    })();
  }, [refreshLatest]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setStatus('working');
    setMessage(label);
    try {
      await fn();
      setStatus('idle');
      setMessage('');
    } catch (e) {
      setStatus('error');
      setMessage(errMsg(e));
    }
  }, []);

  const preflight = useCallback(async () => {
    if (!(await ring.ensurePermissions())) throw new Error('Faltan permisos de Bluetooth.');
    if (!(await ring.bluetoothOn())) throw new Error('Activa el Bluetooth del celular.');
  }, []);

  const findRing = useCallback(async () => {
    setStatus('scanning');
    setMessage('Buscando el anillo…');
    try {
      await preflight();
      const found = await ring.scan();
      if (!found) throw new Error('No encontré el anillo. ¿Está fuera del cargador y lejos de otra app conectada?');
      await setSetting('deviceId', found.id);
      await setSetting('deviceName', found.name);
      setDeviceId(found.id);
      setDeviceName(found.name);
      setStatus('idle');
      setMessage('');
    } catch (e) {
      setStatus('error');
      setMessage(errMsg(e));
    }
  }, [preflight]);

  const needDevice = useCallback(() => {
    if (!deviceId) throw new Error('Primero busca y vincula tu anillo en Ajustes.');
    return deviceId;
  }, [deviceId]);

  const sync = useCallback(() => run('Sincronizando…', async () => {
    await preflight();
    const id = needDevice();
    await ring.withConnection(id, async () => {
      const info = await ring.readInfo();
      if (info.battery != null) {
        setBattery(info.battery);
        await addReading('battery', info.battery, null, 'live');
      }
      await ring.syncTime();
      setMessage('Descargando historial…');
      const { records, raw } = await ring.fetchHistory();
      await saveRawFrames(raw);
      for (const r of records) {
        const v = r.values;
        if (r.kind === 'hr') await addReading('hr', v.bpm, null, 'history', r.at);
        if (r.kind === 'bp') await addReading('bp', v.systolic, v.diastolic, 'history', r.at);
        if (r.kind === 'sport') await addReading('steps', v.steps, null, 'history', r.at);
        if (r.kind === 'all') {
          if (v.bpm) await addReading('hr', v.bpm, null, 'history', r.at);
          if (v.spo2) await addReading('spo2', v.spo2, null, 'history', r.at);
          if (v.hrv) await addReading('hrv', v.hrv, null, 'history', r.at);
          if (v.temp) await addReading('temp', v.temp, null, 'history', r.at);
        }
      }
    });
    const now = new Date().toISOString();
    await setSetting('lastSync', now);
    setLastSync(now);
    await refreshLatest();
  }), [run, preflight, needDevice, refreshLatest]);

  const measure = useCallback((type: MeasureType, seconds: number, onReading: (r: LiveReading) => void) =>
    run('Midiendo… mantén la mano quieta', async () => {
      await preflight();
      const id = needDevice();
      await ring.withConnection(id, () => ring.measure(type, seconds, async (r) => {
        onReading(r);
        if (r.kind === 'hr') await addReading('hr', r.bpm, null, 'live');
        if (r.kind === 'spo2') await addReading('spo2', r.percent, null, 'live');
        if (r.kind === 'bp') await addReading('bp', r.systolic, r.diastolic, 'live');
        if (r.kind === 'temp') await addReading('temp', r.celsius, null, 'live');
      }));
      await refreshLatest();
    }), [run, preflight, needDevice, refreshLatest]);

  const setMonitoring = useCallback((on: boolean) => run(on ? 'Activando monitoreo…' : 'Desactivando monitoreo…', async () => {
    await preflight();
    const id = needDevice();
    await ring.withConnection(id, async () => {
      await ring.syncTime();
      await ring.setAutoMonitoring(on);
    });
    await setSetting('autoMonitoring', on ? '1' : '0');
  }), [run, preflight, needDevice]);

  const value = useMemo<RingState>(() => ({
    status, message, deviceId, deviceName, battery, lastSync, latest,
    findRing, sync, measure, setMonitoring, refreshLatest,
  }), [status, message, deviceId, deviceName, battery, lastSync, latest, findRing, sync, measure, setMonitoring, refreshLatest]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRing(): RingState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRing debe usarse dentro de RingProvider');
  return v;
}
