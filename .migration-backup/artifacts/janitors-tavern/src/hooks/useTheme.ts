import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import type { ThemeMode } from '@/lib/types';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => storage.settings.get().theme);

  useEffect(() => {
    const root = document.documentElement;
    const settings = storage.settings.get();
    const activeTheme = settings.theme;

    const applyTheme = (mode: ThemeMode) => {
      if (mode === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.classList.toggle('dark', prefersDark);
        root.classList.toggle('light', !prefersDark);
      } else if (mode === 'dark') {
        root.classList.remove('light');
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };

    applyTheme(activeTheme);
    setTheme(activeTheme);
  }, []);

  const changeTheme = (newTheme: ThemeMode) => {
    storage.settings.update({ theme: newTheme });
    setTheme(newTheme);
    const root = document.documentElement;
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      root.classList.toggle('light', !prefersDark);
    } else if (newTheme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  };

  return { theme, changeTheme };
}
