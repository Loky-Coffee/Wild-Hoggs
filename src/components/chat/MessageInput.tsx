import { useState, useRef } from 'preact/hooks';

const MAX_LEN = 500;

interface MessageInputProps {
  onSend:       (text: string) => Promise<void>;
  sending:      boolean;
  sendError:    string | null;
  onClearError: () => void;
}

export default function MessageInput({ onSend, sending, sendError, onClearError }: MessageInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    await onSend(trimmed);
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: Event) => {
    const val = (e.target as HTMLTextAreaElement).value;
    if (val.length <= MAX_LEN) {
      setText(val);
      if (sendError) onClearError();
    }
  };

  const remaining = MAX_LEN - text.length;
  const isOverLimit = remaining < 0;
  const canSend = text.trim().length > 0 && !isOverLimit && !sending;

  return (
    <div class="chat-input-area">
      {sendError && (
        <div class="chat-send-error">{sendError}</div>
      )}
      <div class="chat-input-row">
        <textarea
          ref={textareaRef}
          class="chat-textarea"
          placeholder="Schreibe eine Nachricht... (Enter = Senden, Shift+Enter = Zeilenumbruch)"
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MAX_LEN}
          disabled={sending}
        />
        <button
          class="chat-send-btn"
          onClick={handleSubmit}
          disabled={!canSend}
          title="Senden"
        >
          {sending ? '⏳' : '➤'}
        </button>
      </div>
      <div class="chat-input-footer">
        <span class={`chat-char-count${remaining < 50 ? ' chat-char-warn' : ''}`}>
          {remaining} / {MAX_LEN}
        </span>
      </div>
    </div>
  );
}
