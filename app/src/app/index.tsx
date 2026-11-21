import { View } from 'react-native';
import { useRing } from '../state/RingContext';
import { BatteryBar, Big, Button, Card, Label, Muted, Screen, StatusBanner, timeAgo } from '../ui/components';
import { space, useTheme } from '../ui/theme';

export default function Inicio() {
  const t = useTheme();
  const { status, message, deviceId, deviceName, battery, lastSync, latest, sync } = useRing();
  const busy = status === 'working' || status === 'scanning';
  const bp = latest.bp;

  return (
    <Screen title="Mi anillo">
      <StatusBanner status={status} message={message} />

      {!deviceId && (
        <Card>
          <Label>Primer paso</Label>
          <Muted>Ve a Ajustes → “Buscar anillo” para vincularlo con esta app.</Muted>
        </Card>
      )}

      <Card>
        <Label>Batería</Label>
        <Big>{battery != null ? `${battery} %` : '—'}</Big>
        <BatteryBar value={battery} />
        <Muted>{deviceName ?? 'Anillo sin vincular'} · sincronizado {timeAgo(lastSync)}</Muted>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card style={{ flex: 1 }}>
          <Label>Pulso</Label>
          <Big color={t.accent}>{latest.hr ? `${Math.round(latest.hr.v1)}` : '—'}</Big>
          <Muted>{latest.hr ? `lpm · ${timeAgo(latest.hr.at)}` : 'sin datos'}</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>SpO2</Label>
          <Big color={t.accent}>{latest.spo2 ? `${Math.round(latest.spo2.v1)}%` : '—'}</Big>
          <Muted>{latest.spo2 ? timeAgo(latest.spo2.at) : 'sin datos'}</Muted>
        </Card>
      </View>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card style={{ flex: 1 }}>
          <Label>Presión*</Label>
          <Big>{bp ? `${Math.round(bp.v1)}/${Math.round(bp.v2 ?? 0)}` : '—'}</Big>
          <Muted>{bp ? timeAgo(bp.at) : 'sin datos'}</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Label>Temperatura</Label>
          <Big>{latest.temp ? `${latest.temp.v1.toFixed(1)}°` : '—'}</Big>
          <Muted>{latest.temp ? timeAgo(latest.temp.at) : 'sin datos'}</Muted>
        </Card>
      </View>

      <Button title="Sincronizar ahora" onPress={sync} disabled={!deviceId} loading={busy} />
      <Muted>* La presión es una estimación del sensor óptico, no una medición médica. Tus datos se guardan solo en este celular.</Muted>
    </Screen>
  );
}
