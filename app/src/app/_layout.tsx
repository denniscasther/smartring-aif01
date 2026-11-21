import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ColorValue, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RingProvider } from '../state/RingContext';
import { useTheme } from '../ui/theme';

function Icon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{glyph}</Text>;
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <RingProvider>
        <StatusBar style="auto" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.muted,
            tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color }) => <Icon glyph="◉" color={color} /> }} />
          <Tabs.Screen name="medir" options={{ title: 'Medir', tabBarIcon: ({ color }) => <Icon glyph="♥" color={color} /> }} />
          <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIcon: ({ color }) => <Icon glyph="≡" color={color} /> }} />
          <Tabs.Screen name="ajustes" options={{ title: 'Ajustes', tabBarIcon: ({ color }) => <Icon glyph="⚙" color={color} /> }} />
        </Tabs>
      </RingProvider>
    </SafeAreaProvider>
  );
}
