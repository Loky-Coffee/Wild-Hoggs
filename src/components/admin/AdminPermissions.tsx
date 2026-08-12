import { useState, useEffect } from 'preact/hooks';
import { createPortal } from 'preact/compat';

// Rechtevergabe für ein einzelnes Konto.
//
// Die Häkchen hier sind nur die Anzeige — verlassen darf man sich allein auf
// die Prüfung in functions/_lib/permissions.ts. Wer die Adresse einer
// Schnittstelle kennt, ruft sie sonst direkt auf.

export interface RechtDef { id: string; label: string }
export interface RechtGruppe { titel: string; rechte: RechtDef[] }

// Reihenfolge und Bündelung wie im Panel gedacht: was zusammen gebraucht wird,
// steht beieinander.
export const RECHTE_GRUPPEN: RechtGruppe[] = [
  { titel: 'Meldungen', rechte: [
    { id: 'reports.view',    label: 'ansehen' },
    { id: 'reports.resolve', label: 'bearbeiten' },
  ]},
  { titel: 'Nachrichten', rechte: [
    { id: 'messages.delete',  label: 'löschen' },
    { id: 'messages.history', label: 'Verlauf einsehen' },
  ]},
  { titel: 'Nutzer', rechte: [
    { id: 'users.view',  label: 'ansehen' },
    { id: 'users.ban',   label: 'sperren' },
    // Wirkt nur bei Administratoren: Die Schnittstelle verlangt für das
    // Ändern von Rollen und Rechten zusätzlich is_admin.
    { id: 'users.roles', label: 'Rollen und Rechte vergeben (nur als Admin)' },
  ]},
  { titel: 'Gift-Codes', rechte: [
    { id: 'codes.approve', label: 'freigeben' },
    { id: 'codes.manage',  label: 'verwalten' },
  ]},
  { titel: 'Inhalte', rechte: [
    { id: 'content.announcement', label: 'Ankündigung' },
    { id: 'content.rose',         label: 'Glücksrose' },
    { id: 'content.changelog',    label: 'Changelog' },
  ]},
  { titel: 'Auswertung & System', rechte: [
    { id: 'stats.view',      label: 'Statistik ansehen' },
    { id: 'system.settings', label: 'Systemeinstellungen' },
  ]},
];

const ALLE = RECHTE_GRUPPEN.flatMap(g => g.rechte.map(r => r.id));

export const VORLAGEN: { id: string; label: string; rechte: string[] }[] = [
  { id: 'chat-mod',  label: 'Chat-Moderator', rechte: ['reports.view', 'reports.resolve', 'messages.delete', 'users.view'] },
  { id: 'redakteur', label: 'Redakteur',      rechte: ['codes.approve', 'codes.manage', 'content.announcement', 'content.rose', 'content.changelog'] },
  { id: 'voll',      label: 'Voller Zugriff', rechte: ALLE },
  { id: 'nichts',    label: 'Nichts',         rechte: [] },
];

function gleicheMenge(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every(x => b.includes(x));
}

interface Props {
  readonly token: string;
  readonly userId: string;
  readonly username: string;
  readonly istAdmin: boolean;      // Zielkonto ist Administrator
  readonly rechte: string[];       // aktuell vergeben
  readonly onClose: () => void;
  readonly onSaved: (rechte: string[]) => void;
}

export default function AdminPermissions({ token, userId, username, istAdmin, rechte, onClose, onSaved }: Props) {
  const [gewaehlt, setGewaehlt] = useState<string[]>(rechte);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const umschalten = (id: string) =>
    setGewaehlt(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);

  const speichern = async () => {
    setSpeichert(true); setFehler(null);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user_id: userId, permissions: gewaehlt }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setFehler(data.error ?? 'Speichern fehlgeschlagen'); return; }
      onSaved(gewaehlt);
      onClose();
    } catch {
      setFehler('Keine Verbindung zum Server');
    } finally {
      setSpeichert(false);
    }
  };

  return createPortal(
    <div class="admin-dlg-schleier" onClick={onClose}>
      <div class="admin-dlg" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
           aria-label={`Rechte für ${username}`}>
        <div class="admin-dlg-kopf">
          <strong>Rechte für {username}</strong>
          <button class="admin-btn-sm" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div class="admin-dlg-koerper">
          {istAdmin ? (
            <p class="admin-dlg-hinweis">
              Dieses Konto ist Administrator und darf damit ohnehin alles.
              Einzelne Rechte wirken sich erst aus, wenn die Rolle auf Moderator
              oder Mitglied gesetzt wird.
            </p>
          ) : (
            <p class="admin-dlg-hinweis">
              Nur was hier angehakt ist, wird auch serverseitig erlaubt.
            </p>
          )}

          <div class="admin-vorlagen">
            {VORLAGEN.map(v => (
              <button
                key={v.id}
                type="button"
                class="admin-vorlage"
                aria-pressed={gleicheMenge(gewaehlt, v.rechte)}
                onClick={() => setGewaehlt(v.rechte)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {RECHTE_GRUPPEN.map(g => (
            <div class="admin-recht-gruppe" key={g.titel}>
              <div class="admin-recht-titel">{g.titel}</div>
              <div class="admin-recht-reihe">
                {g.rechte.map(r => (
                  <label class="admin-recht" key={r.id}>
                    <input type="checkbox" checked={gewaehlt.includes(r.id)} onChange={() => umschalten(r.id)} />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {fehler && <p class="admin-msg-error">{fehler}</p>}
        </div>

        <div class="admin-dlg-fuss">
          <span>{gewaehlt.length} von {ALLE.length} Rechten vergeben</span>
          <span class="admin-dlg-aktionen">
            <button class="admin-btn-sm" onClick={onClose}>Abbrechen</button>
            <button class="admin-btn-promote" onClick={speichern} disabled={speichert}>
              {speichert ? 'Speichert …' : 'Speichern'}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
