import { useState, useEffect } from 'preact/hooks';

// Betriebseinstellungen: was die Seite tut, nicht was sie anzeigt.
//
// Jeder Schalter hier wirkt sich tatsächlich aus — die Werte werden in den
// betroffenen Schnittstellen gelesen (Registrierung, Chat), nicht nur
// gespeichert. Ein Schalter, der nichts bewirkt, wäre schlimmer als keiner:
// man verlässt sich darauf.

interface Werte { [key: string]: number }

interface Feld {
  key: string;
  titel: string;
  hinweis: string;
  typ: 'schalter' | 'zahl';
  einheit?: string;
  // Bei Schaltern: Welche Stellung soll auffallen? Ein geschlossener Zugang
  // oder abgeschalteter Chat wird sonst tagelang übersehen.
  warnBei?: 0 | 1;
}

const GRUPPEN: { titel: string; felder: Feld[] }[] = [
  {
    titel: 'Zugang',
    felder: [
      { key: 'registration_open', titel: 'Registrierung offen', typ: 'schalter', warnBei: 0,
        hinweis: 'Geschlossen kann sich niemand mehr neu anmelden. Bestehende Konten bleiben unberührt.' },
    ],
  },
  {
    titel: 'Chat',
    felder: [
      { key: 'chat_enabled', titel: 'Öffentlicher Chat', typ: 'schalter', warnBei: 0,
        hinweis: 'Aus können weder global noch im Server-Kanal Nachrichten geschrieben werden. Private Nachrichten laufen weiter.' },
      { key: 'chat_max_length', titel: 'Zeichen je Nachricht', typ: 'zahl', einheit: 'Zeichen',
        hinweis: '50 bis 2000.' },
      { key: 'chat_rate_limit', titel: 'Nachrichten je 5 Minuten', typ: 'zahl', einheit: 'Nachr.',
        hinweis: 'Zusätzlich gilt immer ein Abstand von 10 Sekunden zwischen zwei Nachrichten.' },
    ],
  },
];

export default function AdminSystem({ token }: { readonly token: string }) {
  const [werte, setWerte]     = useState<Werte | null>(null);
  const [busy, setBusy]       = useState<string | null>(null);
  const [fehler, setFehler]   = useState<string | null>(null);
  const [gemerkt, setGemerkt] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error()))
      .then((d: { settings: Werte }) => setWerte(d.settings))
      .catch(() => setFehler('Einstellungen konnten nicht geladen werden.'));
  }, [token]);

  const speichern = async (key: string, wert: number) => {
    const vorher = werte?.[key];
    setWerte(v => ({ ...(v ?? {}), [key]: wert }));   // sofort sichtbar
    setBusy(key); setFehler(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings: { [key]: wert } }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json() as { settings: Werte };
      // Der Server begrenzt Zahlen auf ihren erlaubten Bereich — seine Antwort
      // gilt, sonst zeigt die Oberfläche einen Wert, der nie gespeichert wurde.
      setWerte(d.settings);
      setGemerkt(key);
      setTimeout(() => setGemerkt(g => g === key ? null : g), 1600);
    } catch {
      if (vorher !== undefined) setWerte(v => ({ ...(v ?? {}), [key]: vorher }));
      setFehler('Speichern fehlgeschlagen.');
    } finally {
      setBusy(null);
    }
  };

  if (fehler && !werte) return <p class="admin-empty">{fehler}</p>;
  if (!werte) return <p class="admin-loading">Einstellungen werden geladen …</p>;

  return (
    <>
      {fehler && <p class="admin-msg-error">{fehler}</p>}

      <div class="admin-karten">
        {GRUPPEN.map(g => (
          <div class="admin-karte" key={g.titel}>
            <h4>{g.titel}</h4>
            {g.felder.map(f => {
              const wert = werte[f.key] ?? 0;
              const warnt = f.typ === 'schalter' && f.warnBei !== undefined && wert === f.warnBei;
              return (
                <div class="admin-einstellung" key={f.key}>
                  <div class="admin-einstellung-kopf">
                    <span class={warnt ? 'admin-einstellung-warn' : ''}>{f.titel}</span>
                    {f.typ === 'schalter' ? (
                      <button
                        type="button"
                        class={`admin-kipp${wert === 1 ? ' an' : ''}`}
                        role="switch"
                        aria-checked={wert === 1}
                        aria-label={f.titel}
                        disabled={busy === f.key}
                        onClick={() => speichern(f.key, wert === 1 ? 0 : 1)}
                      />
                    ) : (
                      <span class="admin-zahl-feld">
                        <input
                          class="admin-filter-input"
                          type="number"
                          value={wert}
                          disabled={busy === f.key}
                          onBlur={e => {
                            const n = Number((e.target as HTMLInputElement).value);
                            if (Number.isFinite(n) && n !== wert) speichern(f.key, n);
                          }}
                        />
                        {f.einheit && <span class="admin-einheit">{f.einheit}</span>}
                      </span>
                    )}
                  </div>
                  <p class="admin-einstellung-hinweis">
                    {f.hinweis}
                    {gemerkt === f.key && <span class="admin-gemerkt"> ✓ gespeichert</span>}
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}
