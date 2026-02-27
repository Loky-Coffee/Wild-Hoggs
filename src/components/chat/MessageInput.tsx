import { useState, useRef, useEffect } from 'preact/hooks';

const MAX_LEN = 500;

export interface ReplyTarget {
  id:       string;
  username: string;
  text:     string;
}

interface MessageInputProps {
  onSend:         (text: string) => Promise<void>;
  sending:        boolean;
  sendError:      string | null;
  onClearError:   () => void;
  placeholder:    string;
  sendLabel:      string;
  charsLeft:      string;
  replyTo?:       ReplyTarget | null;
  onCancelReply?: () => void;
}

export default function MessageInput({
  onSend, sending, sendError, onClearError,
  placeholder, sendLabel, charsLeft, replyTo, onCancelReply,
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
          maxLength={MAX_LEN}
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
