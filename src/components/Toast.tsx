"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type Toast = { text: string; error?: boolean } | null;
const Ctx = createContext<(text: string, error?: boolean) => void>(() => {});

/** Small status message at the bottom of the screen ("Saved", "That change did not save…"). */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, error = false) => {
    setToast({ text, error });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), error ? 5000 : 2600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast${toast.error ? " error" : ""}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
