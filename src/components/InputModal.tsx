// Modal de saisie de texte (renommer, nouveau dossier).
import { useEffect, useRef, useState } from "react";

interface Props {
  title: string;
  initial?: string;
  confirmLabel?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputModal({ title, initial = "", confirmLabel = "Valider", placeholder, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const submit = () => {
    const v = value.trim();
    if (v) onSubmit(v);
  };

  return (
    <Backdrop onCancel={onCancel}>
      <div className="text-sm font-medium text-[var(--color-text)] mb-3">{title}</div>
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
      />
      <div className="flex justify-end gap-2 mt-4">
        <Btn onClick={onCancel}>Annuler</Btn>
        <Btn onClick={submit} primary>{confirmLabel}</Btn>
      </div>
    </Backdrop>
  );
}

export function Backdrop({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={onCancel}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-80 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

export function Btn({
  children, onClick, primary, danger,
}: { children: React.ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  const cls = danger
    ? "bg-[var(--color-danger)] text-[var(--color-bg)]"
    : primary
      ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
      : "bg-[var(--color-bg)] text-[var(--color-text-dim)] border border-[var(--color-border)] hover:text-[var(--color-text)]";
  return (
    <button onClick={onClick} className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${cls}`}>
      {children}
    </button>
  );
}
