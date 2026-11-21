import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listReadings, Reading, ReadingKind } from '../db/database';
import { Card, Muted } from '../ui/components';
import { radius, space, useTheme } from '../ui/theme';

const FILTERS: { key: ReadingKind | null; label: string }[] = [
  { key: null, label: 'Todo' }, { key: 'hr', label: 'Pulso' }, { key: 'spo2', label: 'SpO2' },
  { key: 'bp', label: 'Presión' }, { key: 'temp', label: 'Temp' }, { key: 'steps', label: 'Pasos' }, { key: 'hrv', label: 'HRV' },
];

const NAME: Record<ReadingKind, string> = {
  hr: 'Pulso', spo2: 'SpO2', bp: 'Presión', temp: 'Temperatura', steps: 'Pasos', hrv: 'HRV', battery: 'Batería',
};

function value(r: Reading): string {
  switch (r.kind) {
    case 'hr': return `${Math.round(r.v1)} lpm`;
    case 'spo2': return `${Math.round(r.v1)} %`;
    case 'bp': return `${Math.round(r.v1)}/${Math.round(r.v2 ?? 0)}`;
    case 'temp': return `${r.v1.toFixed(1)} °C`;
    case 'steps': return `${Math.round(r.v1)}`;
    default: return `${Math.round(r.v1)}`;
  }
}

export default function Historial() {
  const t = useTheme();
  const [filter, setFilter] = useState<ReadingKind | null>(null);
  const [rows, setRows] = useState<Reading[]>([]);

  useFocusEffect(useCallback(() => {
    listReadings(filter).then(setRows).catch(() => setRows([]));
  }, [filter]));

  const renderItem = useCallback(({ item }: { item: Reading }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.md, borderBottomWidth: 1, borderColor: t.border }}>
      <View>
        <Text style={{ color: t.text, fontWeight: '600' }}>{NAME[item.kind]}</Text>
        <Text style={{ color: t.muted, fontSize: 13 }}>
          {new Date(item.at).toLocaleString()} · {item.source === 'live' ? 'en vivo' : 'automático'}
        </Text>
      </View>
      <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }}>{value(item)}</Text>
    </View>
  ), [t]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ padding: space.lg, gap: space.md, flex: 1 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: t.text }}>Historial</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable key={f.label} onPress={() => setFilter(f.key)}
                style={{ paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: on ? t.accent : t.surface2 }}>
                <Text style={{ color: on ? t.onAccent : t.text, fontWeight: '600' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Card style={{ flex: 1, paddingVertical: 0 }}>
          <FlatList
            data={rows}
            keyExtractor={(r) => String(r.id)}
            renderItem={renderItem}
            ListEmptyComponent={<View style={{ paddingVertical: space.xl }}><Muted>Aún no hay datos. Mide en “Medir” o pulsa “Sincronizar ahora” en Inicio.</Muted></View>}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}
