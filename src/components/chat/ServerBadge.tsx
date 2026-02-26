const FACTION_COLORS: Record<string, string> = {
  'blood-rose':     '#e74c3c',
  'wings-of-dawn':  '#4a9eda',
  'guard-of-order': '#27ae60',
};

interface ServerBadgeProps {
  faction: string | null;
  server:  string | null;
}

export default function ServerBadge({ faction, server }: ServerBadgeProps) {
  const color = faction ? (FACTION_COLORS[faction] ?? 'rgba(255,255,255,0.25)') : 'rgba(255,255,255,0.25)';
  if (!server) return null;
  return (
    <span class="chat-server-badge" style={{ borderColor: color, color }}>
      {server}
    </span>
  );
}
