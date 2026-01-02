import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type FormFactor = 'phone' | 'tablet' | 'desktop';
export type InputMode = 'touch' | 'mouse';
export type Density = 'comfortable' | 'standard' | 'compact';
export type DensityMode = 'auto' | Density;

interface UiContextValue {
  formFactor: FormFactor;
  inputMode: InputMode;
  densityMode: DensityMode;
  density: Density;
  setDensityMode: (mode: DensityMode) => void;
}

const UiContext = createContext<UiContextValue | undefined>(undefined);

const DENSITY_STORAGE_KEY = 'lpedia.ui.densityMode';

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1024, height: 768 };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function getInputMode(): InputMode {
  if (typeof window === 'undefined') return 'mouse';

  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const noHover = window.matchMedia?.('(hover: none)')?.matches ?? false;
  const hasTouchPoints = (navigator?.maxTouchPoints ?? 0) > 0;

  return coarse || noHover || hasTouchPoints ? 'touch' : 'mouse';
}

function getFormFactor(width: number, inputMode: InputMode): FormFactor {
  if (width < 640) return 'phone';
  if (width < 1024) return 'tablet';
  if (inputMode === 'touch') return 'tablet';
  return 'desktop';
}

function getAutoDensity(formFactor: FormFactor, inputMode: InputMode): Density {
  if (formFactor === 'phone') return 'comfortable';
  if (inputMode === 'touch') return 'comfortable';
  if (formFactor === 'desktop') return 'compact';
  return 'standard';
}

export const UiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [{ width, height }, setViewport] = useState(getViewportSize);
  const [inputMode, setInputMode] = useState<InputMode>(() => getInputMode());
  const [densityMode, setDensityModeState] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') return 'auto';
    const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY) as DensityMode | null;
    return raw === 'auto' || raw === 'comfortable' || raw === 'standard' || raw === 'compact' ? raw : 'auto';
  });

  const formFactor = useMemo(() => getFormFactor(width, inputMode), [width, inputMode]);
  const density = useMemo(() => {
    if (densityMode === 'auto') return getAutoDensity(formFactor, inputMode);
    return densityMode;
  }, [densityMode, formFactor, inputMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setViewport(getViewportSize());
    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true } as any);
    window.visualViewport?.addEventListener('resize', onResize, { passive: true });

    const mqlPointer = window.matchMedia?.('(pointer: coarse)');
    const mqlHover = window.matchMedia?.('(hover: none)');
    const onMediaChange = () => setInputMode(getInputMode());
    mqlPointer?.addEventListener?.('change', onMediaChange);
    mqlHover?.addEventListener?.('change', onMediaChange);

    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize as any);
      window.visualViewport?.removeEventListener('resize', onResize as any);
      mqlPointer?.removeEventListener?.('change', onMediaChange);
      mqlHover?.removeEventListener?.('change', onMediaChange);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.formFactor = formFactor;
    root.dataset.input = inputMode;
    root.dataset.density = density;
    root.dataset.densityMode = densityMode;
    root.style.setProperty('--ui-viewport-width', `${width}px`);
    root.style.setProperty('--ui-viewport-height', `${height}px`);
  }, [density, densityMode, formFactor, height, inputMode, width]);

  const setDensityMode = (mode: DensityMode) => {
    setDensityModeState(mode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, mode);
    }
  };

  const value: UiContextValue = {
    formFactor,
    inputMode,
    densityMode,
    density,
    setDensityMode
  };

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
};

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi 必須在 UiProvider 內使用');
  return ctx;
}

