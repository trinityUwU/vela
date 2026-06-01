// Modal de confirmation (suppression).
import { Backdrop, Btn } from "./InputModal";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ message, onConfirm, onCancel }: Props) {
  return (
    <Backdrop onCancel={onCancel}>
      <div className="text-sm text-[var(--color-text)] mb-4">{message}</div>
      <div className="flex justify-end gap-2">
        <Btn onClick={onCancel}>Annuler</Btn>
        <Btn onClick={onConfirm} danger>Supprimer</Btn>
      </div>
    </Backdrop>
  );
}
