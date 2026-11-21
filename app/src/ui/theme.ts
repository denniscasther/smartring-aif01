import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F6F8', surface: '#FFFFFF', surface2: '#EEF1F5', text: '#13161B', muted: '#5B6472',
  border: '#DDE2E9', accent: '#0F9D6A', accentSoft: '#DFF5EC', warn: '#B26A00', warnSoft: '#FFF1DB',
  bad: '#C23B3B', badSoft: '#FDE7E7', onAccent: '#FFFFFF',
};
const dark: typeof light = {
  bg: '#0C0F14', surface: '#141922', surface2: '#1B222D', text: '#E8EDF4', muted: '#9AA6B6',
  border: '#263041', accent: '#34D399', accentSoft: '#11291F', warn: '#F5B454', warnSoft: '#2C2213',
  bad: '#F28B8B', badSoft: '#2D1717', onAccent: '#06140E',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { md: 12, lg: 16, pill: 999 };
