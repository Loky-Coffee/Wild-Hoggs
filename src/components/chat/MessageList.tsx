import { useRef, useEffect } from 'preact/hooks';
import MessageItem, { type Message, type AgoStrings, type MessageStrings } from './MessageItem';

interface MessageListProps {
  messages:        Message[];
  currentUsername: string | null;
  onReport:        (id: string, reason: string) => void;
  reportedIds:     Set<string>;
  noMessages:      string;
  ago:             AgoStrings;
  isAdmin:         boolean;
  onDelete:        (id: string) => Promise<void>;
  onReply:         (msg: Message) => void;
  onPM:            (username: string) => void;
  strings:         MessageStrings;
}

export default function MessageList({
  messages, currentUsername, onReport, reportedIds,
  noMessages, ago, isAdmin, onDelete, onReply, onPM, strings,
}: MessageListProps) {
  const listRef     = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (atBottomRef.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

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
            ago={ago}
            isAdmin={isAdmin}
            onDelete={onDelete}
            onReply={onReply}
            onPM={onPM}
            strings={strings}
          />
        ))
      )}
    </div>
  );
}
