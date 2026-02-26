import { useRef, useEffect } from 'preact/hooks';
import MessageItem, { type Message } from './MessageItem';

interface MessageListProps {
  messages:        Message[];
  currentUsername: string | null;
  onReport:        (id: string) => void;
  reportedIds:     Set<string>;
}

export default function MessageList({ messages, currentUsername, onReport, reportedIds }: MessageListProps) {
  const listRef      = useRef<HTMLDivElement>(null);
  const atBottomRef  = useRef(true);

  // Track whether user is scrolled to the bottom
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-scroll to bottom on new messages — only if already at bottom
  useEffect(() => {
    if (atBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Scroll to bottom on initial mount
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  return (
    <div class="chat-messages" ref={listRef}>
      {messages.length === 0 ? (
        <p class="chat-no-messages">Noch keine Nachrichten. Sei der Erste!</p>
      ) : (
        messages.map(msg => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUsername={currentUsername}
            onReport={onReport}
            reportedIds={reportedIds}
          />
        ))
      )}
    </div>
  );
}
