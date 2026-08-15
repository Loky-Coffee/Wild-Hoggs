import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title:         string;
  message?:      ComponentChildren;
  confirmLabel: string;
  cancelLabel:  string;
  variant?:      'danger' | 'primary';
  onConfirm:     () => void;
  onCancel:      () => void;
  children?:     ComponentChildren;
}

export default function ConfirmDialog({
  title, message, confirmLabel, cancelLabel,
  variant = 'danger', onConfirm, onCancel, children,
}: ConfirmDialogProps) {
  const abbrechenRef = useRef<HTMLButtonElement>(null);

  // Escape schliesst, und der Fokus springt beim Oeffnen in den Dialog.
  //
  // Ohne das blieb der Fokus auf dem Knopf dahinter stehen: Wer mit der
  // Tastatur weitertabbte, landete in der Seite hinter dem Dialog, ohne dass
  // sich sichtbar etwas tat — und Escape, das jeder Dialog versteht, tat
  // nichts. Bewusst der Abbrechen-Knopf, nicht der bestaetigende: Diese
  // Dialoge fragen nach Loeschen und Melden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    abbrechenRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div class="cd-overlay" onClick={onCancel}>
      <div
        class="cd-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="cd-title">{title}</div>
        {message && <div class="cd-message">{message}</div>}
        {children}
        <div class="cd-actions">
          <button ref={abbrechenRef} class="cd-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button class={`cd-confirm cd-confirm-${variant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
