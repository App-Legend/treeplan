import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Tone = 'info' | 'error' | 'success';
interface Toast {
  id: number;
  text: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  show: (text: string, tone?: Tone, action?: Toast['action']) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: number) => setToasts((list) => list.filter((t) => t.id !== id));

  const show = useCallback((text: string, tone: Tone = 'info', action?: Toast['action']) => {
    const id = ++seq;
    setToasts((list) => [...list.slice(-2), { id, text, tone, action }]);
    window.setTimeout(() => dismiss(id), action ? 8000 : 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.text}</span>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button className="toast-close" aria-label="닫기" onClick={() => dismiss(t.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('ToastProvider가 필요합니다.');
  return ctx;
}
