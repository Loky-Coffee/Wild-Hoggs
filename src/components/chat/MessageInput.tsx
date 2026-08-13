import { useState, useRef, useEffect } from 'preact/hooks';

// Standard, bis der Server seine eigene Grenze mitteilt (im Panel
// einstellbar zwischen 50 und 2000).
const STANDARD_MAX_LEN = 500;

export interface ReplyTarget {
  id:       string;
  username: string;
  text:     string;
}

interface MessageInputProps {
  /** Liefert true, wenn die Nachricht wirklich abgeschickt wurde. */
  onSend:         (text: string) => Promise<boolean>;
  sending:        boolean;
  sendError:      string | null;
  onClearError:   () => void;
  placeholder:    string;
  sendLabel:      string;
  charsLeft:      string;
  replyTo?:       ReplyTarget | null;
  onCancelReply?: () => void;
  /** Vom Server gemeldete Zeichengrenze. */
  maxLen?:        number;
}

export default function MessageInput({
  onSend, sending, sendError, onClearError,
  placeholder, sendLabel, charsLeft, replyTo, onCancelReply,
  maxLen = STANDARD_MAX_LEN,
}: MessageInputProps) {
  const [text, setText]     = useState('');
  const textareaRef         = useRef<HTMLTextAreaElement>(null);

  // Focus textarea whenever a reply is selected
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo?.id]);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    // Das Feld nur leeren, wenn die Nachricht auch angekommen ist. Vorher wurde
    // es immer geleert — bei Verbindungsabbruch, Sendesperre oder Serverfehler
    // war das Geschriebene damit weg, und die Fehlermeldung daneben half wenig,
    // weil nichts mehr dastand, was man erneut hätte abschicken können.
    const gesendet = await onSend(trimmed);
    if (gesendet) setText('');
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
    if (val.length <= maxLen) {
      setText(val);
      if (sendError) onClearError();
    }
  };

  const remaining = maxLen - text.length;
  const canSend   = text.trim().length > 0 && remaining >= 0 && !sending;

  return (
    <div class="chat-input-area">
      {replyTo && (
        <div class="chat-reply-bar">
          <div class="chat-reply-bar-content">
            <span class="chat-reply-bar-author">↩ {replyTo.username}</span>
            <span class="chat-reply-bar-text">{replyTo.text}</span>
          </div>
          <button class="chat-reply-bar-cancel" onClick={onCancelReply} title="Antwort abbrechen">✕</button>
        </div>
      )}
      {sendError && (
        <div class="chat-send-error">{sendError}</div>
      )}
      <div class="chat-input-row">
        <textarea
          ref={textareaRef}
          class="chat-textarea"
          placeholder={placeholder}
          value={text}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={maxLen}
          disabled={sending}
        />
        <button
          class="chat-send-btn"
          onClick={handleSubmit}
          disabled={!canSend}
          title={sendLabel}
        >
          {sending ? '⏳' : '➤'}
        </button>
      </div>
      <div class="chat-input-footer">
        <span class={`chat-char-count${remaining < 50 ? ' chat-char-warn' : ''}`}>
          {remaining} {charsLeft}
        </span>
      </div>
    </div>
  );
}
