import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, useTheme } from './theme';

export function Screen({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 }}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }, style]}>{children}</View>;
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={[styles.label, { color: t.muted }]}>{children}</Text>;
}

export function Big({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={[styles.big, { color: color ?? t.text }]}>{children}</Text>;
}

export function Muted({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, fontSize: 14 }}>{children}</Text>;
}

export function Button({ title, onPress, disabled, variant = 'primary', loading }: {
  title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary'; loading?: boolean;
}) {
  const t = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: primary ? t.accent : t.surface2, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={primary ? t.onAccent : t.text} /> :
        <Text style={{ color: primary ? t.onAccent : t.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function StatusBanner({ status, message }: { status: string; message: string }) {
  const t = useTheme();
  if (!message) return null;
  const err = status === 'error';
  return (
    <View style={[styles.banner, { backgroundColor: err ? t.badSoft : t.accentSoft }]}>
      {!err && <ActivityIndicator size="small" color={t.accent} />}
      <Text style={{ color: err ? t.bad : t.accent, flex: 1, fontWeight: '600' }}>{message}</Text>
    </View>
  );
}

export function BatteryBar({ value }: { value: number | null }) {
  const t = useTheme();
  const v = value ?? 0;
  const color = v <= 20 ? t.bad : v <= 50 ? t.warn : t.accent;
  return (
    <View style={[styles.batteryTrack, { backgroundColor: t.surface2 }]}>
      <View style={{ width: `${v}%`, height: '100%', backgroundColor: color, borderRadius: radius.pill }} />
    </View>
  );
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return 'hace un momento';
  const m = Math.round(s / 60);
  if (m < 90) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 36) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: space.xs },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  big: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  button: { minHeight: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  banner: { flexDirection: 'row', gap: space.sm, alignItems: 'center', borderRadius: radius.md, padding: space.md },
  batteryTrack: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
});
