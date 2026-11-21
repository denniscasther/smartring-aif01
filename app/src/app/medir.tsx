import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { LiveReading, MeasureType } from '../ble/ycbt';
import { useRing } from '../state/RingContext';
import { Big, Button, Card, Label, Muted, Screen, StatusBanner } from '../ui/components';
import { space, useTheme } from '../ui/theme';

const OPTIONS: { type: MeasureType; title: string; seconds: number; hint: string }[] = [
  { type: MeasureType.HeartRate, title: 'Pulso', seconds: 45, hint: '~15 s para el primer valor' },
  { type: MeasureType.SpO2, title: 'SpO2', seconds: 70, hint: '~40 s para el primer valor' },
  { type: MeasureType.BloodPressure, title: 'Presión (estimada)', seconds: 50, hint: '~20 s' },
  { type: MeasureType.Temperature, title: 'Temperatura', seconds: 45, hint: '~5 s' },
];

function describe(r: LiveReading | null): string {
  if (!r) return '—';
  switch (r.kind) {
    case 'hr': case 'status': return `${r.bpm} lpm`;
    case 'spo2': return `${r.percent} %`;
    case 'bp': return `${r.systolic}/${r.diastolic}`;
    case 'temp': return `${r.celsius.toFixed(1)} °C`;
    default: return '—';
  }
}

export default function Medir() {
  const t = useTheme();
  const { status, message, deviceId, measure } = useRing();
  const [active, setActive] = useState<MeasureType | null>(null);
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [pulse, setPulse] = useState<number | null>(null);
  const busy = status === 'working' || status === 'scanning';

  const start = useCallback(async (type: MeasureType, seconds: number) => {
    setActive(type);
    setReading(null);
    setPulse(null);
    await measure(type, seconds, (r) => {
      if (r.kind === 'status') setPulse(r.bpm);
      else if (r.kind !== 'end') setReading(r);
    });
    setActive(null);
  }, [measure]);

  return (
    <Screen title="Medir ahora">
      <StatusBanner status={status} message={message} />
      <Muted>Ponte el anillo ajustado, apoya la mano y no la muevas. La luz verde se encenderá.</Muted>

      {active !== null && (
        <Card>
          <Label>En curso</Label>
          <Big color={t.accent}>{describe(reading)}</Big>
          <Muted>{pulse ? `pulso de referencia: ${pulse} lpm` : 'esperando al sensor…'}</Muted>
        </Card>
      )}

      <View style={{ gap: space.md }}>
        {OPTIONS.map((o) => (
          <Card key={o.type}>
            <Label>{o.title}</Label>
            <Muted>{o.hint} · hasta {o.seconds} s</Muted>
            <Button
              title={active === o.type ? 'Midiendo…' : `Medir ${o.title.toLowerCase()}`}
              onPress={() => start(o.type, o.seconds)}
              disabled={!deviceId || busy}
              loading={active === o.type}
            />
          </Card>
        ))}
      </View>
    </Screen>
  );
}
