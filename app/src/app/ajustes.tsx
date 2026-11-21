import { useRing } from '../state/RingContext';
import { Button, Card, Label, Muted, Screen, StatusBanner } from '../ui/components';

export default function Ajustes() {
  const { status, message, deviceId, deviceName, findRing, setMonitoring } = useRing();
  const busy = status === 'working' || status === 'scanning';

  return (
    <Screen title="Ajustes">
      <StatusBanner status={status} message={message} />

      <Card>
        <Label>Anillo vinculado</Label>
        <Muted>{deviceId ? `${deviceName ?? 'AIF01'}` : 'Ninguno todavía'}</Muted>
        <Button title={deviceId ? 'Buscar de nuevo' : 'Buscar anillo'} onPress={findRing} loading={status === 'scanning'} disabled={busy} />
        <Muted>Saca el anillo del cargador y cierra SmartHealth: el anillo solo acepta una conexión a la vez.</Muted>
      </Card>

      <Card>
        <Label>Monitoreo automático</Label>
        <Muted>El anillo mide solo cada cierto tiempo y guarda el resultado. La app lo descarga al sincronizar. Gasta algo más de batería.</Muted>
        <Button title="Activar (y sincronizar hora)" onPress={() => setMonitoring(true)} disabled={!deviceId || busy} />
        <Button title="Desactivar" variant="secondary" onPress={() => setMonitoring(false)} disabled={!deviceId || busy} />
      </Card>

      <Card>
        <Label>Privacidad</Label>
        <Muted>Tus mediciones se guardan solo en este celular (SQLite). La app nunca envía comandos de borrado al anillo.</Muted>
      </Card>
    </Screen>
  );
}
