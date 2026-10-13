import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const Ctx = createContext<{ toast: (text: string) => void; error: (e: unknown) => void }>({
  toast: () => {},
  error: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast['kind']) => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const toast = useCallback((text: string) => push(text, 'ok'), [push]);
  const error = useCallback((e: unknown) => push(e instanceof Error ? e.message : String(e), 'error'), [push]);
  return (
    <Ctx.Provider value={{ toast, error }}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>{t.text}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
