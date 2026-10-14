import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: ReactNode;
  onClose?: () => void;
  labelledBy: string;
  size?: 'sm' | 'md';
  /** 생성 중처럼 닫으면 안 되는 순간에는 false */
  dismissible?: boolean;
}

export default function Modal({ children, onClose, labelledBy, size = 'md', dismissible = true }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, dismissible]);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose?.();
      }}
    >
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {onClose && dismissible && (
          <button className="modal-close" aria-label="닫기" onClick={onClose}>
            ×
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
