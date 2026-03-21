import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { createLogger } from '@/lib/logger';

const log = createLogger({ context: 'Theme' });

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'theme_pref';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolvedTheme: 'light' | 'dark') {
  const root = document.documentElement;
  // Add transitioning class for smooth color transitions
  root.classList.add('transitioning');
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  // Remove transitioning class after animation completes
  requestAnimationFrame(() => {
    setTimeout(() => root.classList.remove('transitioning'), 300);
  });
}

function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'system') {
    return getSystemTheme();
  }
  return preference;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth();
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    // Initialize from localStorage for immediate load
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
    return 'system';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    return resolveTheme(theme);
  });

  // Apply theme immediately and whenever it changes
  useEffect(() => {
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Sync with profile from DB when it loads
  useEffect(() => {
    if (profile && 'theme_pref' in profile) {
      const dbTheme = (profile as any).theme_pref as ThemePreference;
      if (dbTheme && dbTheme !== theme) {
        setThemeState(dbTheme);
        localStorage.setItem(STORAGE_KEY, dbTheme);
      }
    }
  }, [profile]);

  // Listen for system theme changes when preference is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: ThemePreference) => {
    // Update state and localStorage immediately for instant feedback
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);

    // Persist to DB if user is authenticated
    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ theme_pref: newTheme })
          .eq('id', user.id);
      } catch (error) {
        log.error('Error saving theme preference:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
