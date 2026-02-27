import type { ComponentChildren } from 'preact';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  title:         string;
  message?:      ComponentChildren;
  confirmLabel?: string;
  cancelLabel?:  string;
  variant?:      'danger' | 'primary';
  onConfirm:     () => void;
  onCancel:      () => void;
  children?:     ComponentChildren;
}

export default function ConfirmDialog({
  title, message, confirmLabel = 'OK', cancelLabel = 'Abbrechen',
  variant = 'danger', onConfirm, onCancel, children,
}: ConfirmDialogProps) {
  return (
    <div class="cd-overlay" onClick={onCancel}>
      <div class="cd-dialog" onClick={(e) => e.stopPropagation()}>
        <div class="cd-title">{title}</div>
        {message && <div class="cd-message">{message}</div>}
        {children}
        <div class="cd-actions">
          <button class="cd-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button class={`cd-confirm cd-confirm-${variant}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
