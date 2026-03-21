import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type BrokerTheme = 'light' | 'dark' | 'system';

interface BrokerThemeContextValue {
  theme: BrokerTheme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: BrokerTheme) => void;
}

const BrokerThemeContext = createContext<BrokerThemeContextValue>({
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
});

const STORAGE_KEY = 'broker_theme_pref';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.add('transitioning');
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  requestAnimationFrame(() => {
    setTimeout(() => root.classList.remove('transitioning'), 300);
  });
}

export function BrokerThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BrokerTheme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {}
    return 'light';
  });

  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Listen to system preference changes
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  // Apply dark/light class to <html> so CSS variables respond
  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((newTheme: BrokerTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {}
  }, []);

  return (
    <BrokerThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </BrokerThemeContext.Provider>
  );
}

export function useBrokerTheme() {
  return useContext(BrokerThemeContext);
}
