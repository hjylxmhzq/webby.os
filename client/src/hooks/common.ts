import { useCallback, useEffect, useRef, useState } from "react";
import events from 'events';

export function useRefresh(): [number, () => void] {
  const [signal, refresh] = useState(0);
  return [signal, () => refresh(signal + 1)];
}

export type Theme = 'light' | 'dark';

const ev = new events();

let currentTheme: Theme = localStorage.getItem('theme') as Theme;
if (!currentTheme) {
  const mm = matchMedia('(prefers-color-scheme: dark)');
  if (mm.matches) {
    currentTheme = 'dark';
  } else {
    currentTheme = 'light';
  }
}

export function useTheme(): [Theme, (theme: Theme) => void, () => void] {
  const [theme, _setTheme] = useState<Theme>(currentTheme);
  const setTheme = useCallback((theme: Theme) => {
    currentTheme = theme;
    localStorage.setItem('theme', theme);
    ev.emit('theme', theme);
  }, []);
  const toggle = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light');
    }
  }
  useEffect(() => {
    ev.on('theme', (theme: Theme) => {
      _setTheme(theme);
    });
    const mm = matchMedia('(prefers-color-scheme: dark)');
    const changeColorSchema = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light');
    };
    mm.addEventListener('change', changeColorSchema, false);
    return () => {
      mm.removeEventListener('change', changeColorSchema, false);
    }
  }, [setTheme]);
  return [theme, setTheme, toggle];
}


export function useDebounceValue(val: any, delay = 100) {
  const timer = useRef<undefined | number>(undefined);
  const [pending, setPending] = useState(false);
  const [debouncedVal, setDebouncedVal] = useState(val);
  const lastVal = useRef(val);
  useEffect(() => {
    if (!timer.current) {
      setDebouncedVal(val);
    }
    if (lastVal.current === val) {
      return;
    }
    lastVal.current = val;
    setPending(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setDebouncedVal(val);
      setPending(false);
      timer.current = undefined;
    }, delay);
    return;
  }, [val, delay]);
  return [debouncedVal, pending] as [any, boolean];
}