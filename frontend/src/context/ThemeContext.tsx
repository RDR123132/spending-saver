import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
  light: {
    background: '#FDFBF7',
    surface: '#FFFFFF',
    primary: '#FF90E8',
    secondary: '#90A8ED',
    accent: '#FFC900',
    text: '#0A0A0A',
    textMuted: '#52525B',
    border: '#0A0A0A',
    error: '#FF453A',
    success: '#32D74B',
    shadow: '#0A0A0A',
  },
  dark: {
    background: '#0F0F0F',
    surface: '#1A1A1A',
    primary: '#FF90E8',
    secondary: '#90A8ED',
    accent: '#FFC900',
    text: '#FAFAFA',
    textMuted: '#A1A1AA',
    border: '#FAFAFA',
    error: '#FF453A',
    success: '#32D74B',
    shadow: '#FF90E8',
  },
} as const;

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  colors: typeof COLORS.light;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  colors: COLORS.light,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((stored) => {
      if (stored === 'dark' || stored === 'light') setMode(stored);
    });
  }, []);

  const toggleTheme = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setMode(next);
    AsyncStorage.setItem('theme_mode', next);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem('theme_mode', newMode);
  };

  return (
    <ThemeContext.Provider value={{ mode, colors: COLORS[mode], toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
