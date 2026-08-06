import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useAuth } from '../hooks/useAuth';
import './UpdateNotice.css';

// Hinweisbalken unten rechts. Zeigt zweierlei:
//
//   1. Eine Ankündigung des Betreibers (aus dem Admin-Bereich gesetzt).
//   2. Den Hinweis, dass im Browser eine ältere Fassung der Seite läuft.
//
// Wer die Seite tagelang offen lässt, behält sonst den alten Stand, bis er
// zufällig neu lädt. Deshalb wird die Kennung des geladenen Builds mit der auf
// dem Server verglichen.
//
// Beim Neuladen bewusst unterschiedlich:
//   • Tab im Hintergrund -> still neu laden. Da tippt niemand, es kann nichts
//     verloren gehen.
//   • Tab im Vordergrund -> nur ein Knopf. Ein Neuladen mitten im Schreiben
//     würde den Text vernichten.

const CHECK_MS = 5 * 60 * 1000;          // zusätzlich alle 5 Minuten
const SEEN_KEY = 'wh-seen-announcement'; // zuletzt weggeklickte Ankündigung

interface Announcement {
  id: string;
  text: string;
  reload: boolean;
}

interface Props {
  readonly label:  string;   // "Neue Version verfügbar"
  readonly hint:   string;   // "Lade die Seite neu, um sie zu nutzen."
  readonly action: string;   // "Neu laden"
  readonly later:  string;   // "Später"
  readonly close:  string;   // "Schließen"
}

export default function UpdateNotice({ label, hint, action, later, close }: Props) {
  const { isLoggedIn } = useAuth();
  const [outdated, setOutdated] = useState(false);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const outdatedRef = useRef(false);

  // Vom Chat-Hub zugestellte Ankündigung — kommt sofort, ohne auf den nächsten
  // Abruf zu warten. Der Chat feuert dieses Ereignis, wenn er verbunden ist.
  useEffect(() => {
    const onLive = (e: Event) => {
      const a = (e as CustomEvent).detail as Announcement | null;
      if (a?.id && a.text) showIfUnseen(a);
    };
    window.addEventListener('wh-announcement', onLive);
    return () => window.removeEventListener('wh-announcement', onLive);
  }, []);

  const showIfUnseen = (a: Announcement) => {
    try {
      if (localStorage.getItem(SEEN_KEY) === a.id) return;   // schon weggeklickt
    } catch { /* ignore */ }
    setAnnouncement(a);
  };

  // Merkt sich, dass diese Ankündigung erledigt ist. Ohne das erscheint sie
  // nach jedem Neuladen wieder, solange sie in der Datenbank steht.
  const markSeen = () => {
    try { if (announcement) localStorage.setItem(SEEN_KEY, announcement.id); } catch { /* ignore */ }
  };

  const dismiss = () => {
    markSeen();
    setAnnouncement(null);
  };

  // Auch der Neu-laden-Knopf muss sie abhaken — sonst begrüßt sie einen die
  // frisch geladene Seite sofort wieder.
  const reloadAndDismiss = () => {
    markSeen();
    location.reload();
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    let stopped = false;

    const check = async () => {
      if (stopped) return;

      // ── Ankündigung ──────────────────────────────────────────────────────
      try {
        const res = await fetch('/api/announcement', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json() as { announcement: Announcement | null };
          if (data.announcement?.id && data.announcement.text) showIfUnseen(data.announcement);
          else setAnnouncement(null);
        }
      } catch { /* offline o.ä. */ }

      // ── Neue Fassung? ────────────────────────────────────────────────────
      // Beim Entwickeln ist die Kennung 'dev' — dann gibt es nichts zu prüfen.
      if (typeof __BUILD_ID__ === 'undefined' || __BUILD_ID__ === 'dev') return;
      if (outdatedRef.current) return;
      try {
        const res = await fetch('/version.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json() as { build?: string };
        if (!data.build || data.build === __BUILD_ID__) return;

        if (document.visibilityState === 'hidden') { location.reload(); return; }
        outdatedRef.current = true;
        setOutdated(true);
      } catch { /* offline o.ä. — beim nächsten Mal wieder */ }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };

    const timer = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    check();

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoggedIn]);

  if (!isLoggedIn) return null;

  // Eine Ankündigung geht vor — sie ist die bewusste Botschaft.
  if (announcement) {
    return createPortal(
      <div class="update-backdrop" onClick={dismiss}>
        <div
          class="update-card"
          role="dialog"
          aria-modal="true"
          onClick={e => e.stopPropagation()}
        >
          <button type="button" class="update-close" onClick={dismiss} aria-label="OK">✕</button>
          <div class="update-icon" aria-hidden="true">📢</div>
          <p class="update-text">{announcement.text}</p>
          <div class="update-actions">
            {announcement.reload && (
              <button type="button" class="update-btn" onClick={reloadAndDismiss}>
                {action}
              </button>
            )}
            {/* Immer ein Weg heraus — auch bei einer Neu-laden-Aufforderung.
                Wer gerade mitten im Schreiben ist, soll nicht festsitzen. */}
            <button type="button" class="update-btn-ghost" onClick={dismiss}>{close}</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!outdated) return null;

  return createPortal(
    <div class="update-backdrop" onClick={() => setOutdated(false)}>
      <div
        class="update-card"
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          class="update-close"
          onClick={() => setOutdated(false)}
          aria-label={close}
        >✕</button>
        <div class="update-icon" aria-hidden="true">✨</div>
        <p class="update-title">{label}</p>
        <p class="update-text">{hint}</p>
        <div class="update-actions">
          <button type="button" class="update-btn" onClick={() => location.reload()}>
            {action}
          </button>
          <button type="button" class="update-btn-ghost" onClick={() => setOutdated(false)}>
            {later}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
