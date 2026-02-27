import { useRef, useEffect } from 'preact/hooks';
import MessageItem, { type Message, type AgoStrings } from './MessageItem';

interface MessageListProps {
  messages:        Message[];
  currentUsername: string | null;
  onReport:        (id: string) => void;
  reportedIds:     Set<string>;
  noMessages:      string;
  reportLabel:     string;
  reportedLabel:   string;
  ago:             AgoStrings;
  isAdmin:         boolean;
  onDelete:        (id: string) => void;
  onReply:         (msg: Message) => void;
}

export default function MessageList({
  messages, currentUsername, onReport, reportedIds,
  noMessages, reportLabel, reportedLabel, ago, isAdmin, onDelete, onReply,
}: MessageListProps) {
  const listRef     = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

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

  // Auto-scroll on new messages — only if already at bottom
  useEffect(() => {
    if (atBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Scroll to bottom on first mount
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  return (
    <div class="chat-messages" ref={listRef}>
      {messages.length === 0 ? (
        <p class="chat-no-messages">{noMessages}</p>
      ) : (
        messages.map(msg => (
          <MessageItem
            key={msg.id}
            msg={msg}
            currentUsername={currentUsername}
            onReport={onReport}
            reportedIds={reportedIds}
            reportLabel={reportLabel}
            reportedLabel={reportedLabel}
            ago={ago}
            isAdmin={isAdmin}
            onDelete={onDelete}
            onReply={onReply}
          />
        ))
      )}
    </div>
  );
}
