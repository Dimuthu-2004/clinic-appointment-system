import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const THEME_STORAGE_KEY = 'clinic-theme-mode';

export const lightColors = {
  primary: '#0E7490',
  primaryDark: '#155E75',
  secondary: '#14B8A6',
  accent: '#F59E0B',
  background: '#EDF6F4',
  surface: '#FFFFFF',
  surfaceMuted: '#E3EFEC',
  text: '#10343C',
  textMuted: '#5E7680',
  border: '#CDDDE0',
  danger: '#D14343',
  success: '#1F8A5B',
  info: '#3B82F6',
};

export const darkColors = {
  primary: '#22D3EE',
  primaryDark: '#67E8F9',
  secondary: '#2DD4BF',
  accent: '#FBBF24',
  background: '#071A20',
  surface: '#102A33',
  surfaceMuted: '#183844',
  text: '#E8F7FA',
  textMuted: '#A7C4CC',
  border: '#2B505B',
  danger: '#F87171',
  success: '#4ADE80',
  info: '#93C5FD',
};

export const colors = lightColors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
};

export const radii = {
  sm: 10,
  md: 16,
  lg: 24,
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#0B2430',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  android: {
    elevation: 4,
  },
});

const ThemeContext = createContext({
  colors: lightColors,
  isDark: false,
  themeName: 'light',
  toggleTheme: () => {},
  setThemeName: () => {},
});

export function ThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState('light');

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);

      if (savedTheme === 'dark' || savedTheme === 'light') {
        setThemeNameState(savedTheme);
      }
    };

    loadTheme();
  }, []);

  const setThemeName = async (nextThemeName) => {
    const normalizedThemeName = nextThemeName === 'dark' ? 'dark' : 'light';
    setThemeNameState(normalizedThemeName);
    await SecureStore.setItemAsync(THEME_STORAGE_KEY, normalizedThemeName);
  };

  const value = useMemo(() => {
    const activeColors = themeName === 'dark' ? darkColors : lightColors;

    return {
      colors: activeColors,
      isDark: themeName === 'dark',
      themeName,
      setThemeName,
      toggleTheme: () => setThemeName(themeName === 'dark' ? 'light' : 'dark'),
    };
  }, [themeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
