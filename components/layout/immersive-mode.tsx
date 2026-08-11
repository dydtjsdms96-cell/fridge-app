"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ImmersiveModeContextValue = {
  immersive: boolean;
  enter: () => void;
  exit: () => void;
};

const ImmersiveModeContext = createContext<ImmersiveModeContextValue | null>(
  null,
);

export function ImmersiveModeProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);

  const enter = useCallback(() => {
    setDepth((d) => d + 1);
  }, []);

  const exit = useCallback(() => {
    setDepth((d) => Math.max(0, d - 1));
  }, []);

  const value = useMemo(
    () => ({
      immersive: depth > 0,
      enter,
      exit,
    }),
    [depth, enter, exit],
  );

  return (
    <ImmersiveModeContext.Provider value={value}>
      {children}
    </ImmersiveModeContext.Provider>
  );
}

export function useImmersiveModeState() {
  const ctx = useContext(ImmersiveModeContext);
  if (!ctx) {
    return { immersive: false, enter: () => {}, exit: () => {} };
  }
  return ctx;
}

/** While mounted (or while `active`), hide the app tab bar. */
export function useImmersiveMode(active = true) {
  const { enter, exit } = useImmersiveModeState();

  useEffect(() => {
    if (!active) return;
    enter();
    return () => exit();
  }, [active, enter, exit]);
}
