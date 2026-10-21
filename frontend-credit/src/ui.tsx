import { useEffect, useRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
export const icons = {
  history: "682f8",
  copy: "37fce",
  users: "65a75",
  down: "4dcea",
  up: "52bae",
  close: "75268",
  shuffle: "a86d6",
  edit: "4aff9",
  delete: "bad40",
  plus: "846fc",
  minus: "cb30f",
  hand: "ec003",
  pointer: "d8a09",
  fit: "0052c",
  search: "c2837",
};
export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <span className="icon">
      <img src={`/assets/${icons[name]}.svg`} alt="" draggable="false" />
    </span>
  );
}
export function Button({
  children,
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark";
  children: ReactNode;
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Numbered({ n, children }: { n: string; children: ReactNode }) {
  return (
    <h2 className="numbered">
      <span className="number">{n}</span>
      {children}
    </h2>
  );
}
export function Logo() {
  return (
    <picture>
      <source media="(max-width:767px)" srcSet="/assets/91486.svg" />
      <img className="logo" src="/assets/5d465.svg" alt="treeplan." />
    </picture>
  );
}
export function Modal({
  children,
  label,
  onClose,
  className = "",
}: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const background = [
      ...document.querySelectorAll<HTMLElement>(".app > header, .app > main"),
    ];
    background.forEach((element) => {
      element.inert = true;
    });
    const timer = setTimeout(() => ref.current?.focus(), 0);
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close.current();
      }
      if (e.key === "Tab") {
        const list = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select,[tabindex="0"]',
        );
        if (!list?.length) {
          e.preventDefault();
          return;
        }
        const first = list[0],
          last = list[list.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = old;
      background.forEach((element) => {
        element.inert = false;
      });
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, []);
  return (
    <div
      className={`overlay ${className}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="dialog"
      >
        <div className="sheet-handle" />
        {children}
      </div>
    </div>
  );
}
export function Close({ onClick }: { onClick: () => void }) {
  return (
    <button className="icon-button close" aria-label="닫기" onClick={onClick}>
      <Icon name="close" />
    </button>
  );
}
