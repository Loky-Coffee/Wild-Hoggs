import { getToken, validateSession } from '../../_lib/auth';
import { verlangt } from '../../_lib/permissions';

// GET /api/admin/stats — Zahlen zum Betrieb der Seite
//
// Alles kommt aus Feldern, die ohnehin vorhanden sind: Anmeldungen aus den
// Sitzungen, Aktivität aus last_seen, Interessen aus den gespeicherten
// Rechnerständen. Es wird nichts zusätzlich mitgeschrieben — kein Tracking,
// keine Einwilligung nötig, nichts zu löschen.
//
// Ein einziger D1-Batch: 13 Abfragen in einem Rutsch statt 13 Rundreisen.

export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(user, 'stats.view');
  if (nein) return nein;

  const [
    eckdaten, stunden, monate, sprachen, fraktionen, server,
    rechner, chatStunden, chatTage, neueste, aktivste, meldungen, codes,
  ] = await DB.batch([
    // Die großen Zahlen für die Kopfzeile
    DB.prepare(`
      SELECT (SELECT COUNT(*) FROM users) AS konten,
             -- datetime statt date: datetime('now','-30 days') liefert Mitternacht,
             -- das Fenster war je nach Tageszeit bis zu 31 Tage lang. Die
             -- beiden Zeilen darunter machen es bereits richtig.
             (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now','-30 days')) AS konten_30t,
             (SELECT COUNT(*) FROM users WHERE last_seen  >= datetime('now','-24 hours')) AS aktiv_24h,
             (SELECT COUNT(*) FROM users WHERE last_seen  >= datetime('now','-7 days'))  AS aktiv_7t,
             (SELECT COUNT(*) FROM chat_global) AS chat_global,
             (SELECT COUNT(*) FROM chat_server) AS chat_server,
             (SELECT COUNT(*) FROM chat_pm)     AS chat_pm,
             (SELECT COUNT(*) FROM game_profiles) AS spielprofile
    `),

    // Wann sich Leute anmelden — die Frage "wann sind meine Leute da?"
    DB.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) AS stunde, COUNT(*) AS n
        FROM sessions GROUP BY stunde ORDER BY stunde
    `),

    // Wachstum über die letzten zwölf Monate
    DB.prepare(`
      SELECT strftime('%Y-%m', created_at) AS monat, COUNT(*) AS n
        FROM users
       WHERE created_at >= date('now','-12 months')
       GROUP BY monat ORDER BY monat
    `),

    DB.prepare(`
      SELECT COALESCE(NULLIF(language,''),'?') AS wert, COUNT(*) AS n
        FROM users GROUP BY wert ORDER BY n DESC
    `),
    DB.prepare(`
      SELECT COALESCE(NULLIF(faction,''),'—') AS wert, COUNT(*) AS n
        FROM users GROUP BY wert ORDER BY n DESC
    `),
    DB.prepare(`
      SELECT COALESCE(NULLIF(server,''),'—') AS wert, COUNT(*) AS n
        FROM users GROUP BY wert ORDER BY n DESC LIMIT 12
    `),

    // Welche Rechner tatsächlich benutzt werden. Die Schalter-Zustände
    // ('*-hidedupes', '*speed', '*-saving') sind Einstellungen, keine Rechner —
    // sie würden die Liste sonst verfälschen.
    DB.prepare(`
      SELECT calc_type AS wert, COUNT(*) AS n
        FROM calculator_states
       WHERE calc_type NOT LIKE '%speed%'
         AND calc_type NOT LIKE '%hidedupes%'
         AND calc_type NOT LIKE '%saving%'
       GROUP BY wert ORDER BY n DESC
    `),

    DB.prepare(`
      SELECT CAST(strftime('%H', created_at) AS INTEGER) AS stunde, COUNT(*) AS n
        FROM chat_global GROUP BY stunde ORDER BY stunde
    `),
    DB.prepare(`
      SELECT date(created_at) AS tag, COUNT(*) AS n
        FROM chat_global
       WHERE created_at >= datetime('now','-30 days')
       GROUP BY tag ORDER BY tag
    `),

    DB.prepare(`
      SELECT username, created_at, server FROM users
       ORDER BY created_at DESC LIMIT 5
    `),
    DB.prepare(`
      SELECT u.username, COUNT(g.id) AS n
        FROM users u JOIN chat_global g ON g.user_id = u.id
       GROUP BY u.id ORDER BY n DESC LIMIT 5
    `),

    // Nur die unerledigten: Der Zähler hiess schon immer "offen", zählte aber
    // jede jemals eingegangene Meldung. Im Panel stand dauerhaft eine Zahl,
    // hinter der nichts mehr zu tun war — und so eine Zahl schaut man
    // irgendwann nicht mehr an.
    DB.prepare(`SELECT COUNT(*) AS offen FROM chat_reports
                 WHERE status = 'open' OR status IS NULL`),
    // COALESCE ist hier nicht kosmetisch: SUM über eine leere Tabelle liefert
    // NULL, und im Panel stünde dann "null" statt einer Null.
    DB.prepare(`
      SELECT COALESCE(SUM(status = 'pending'),  0) AS wartend,
             COALESCE(SUM(status = 'approved'), 0) AS aktiv
        FROM reward_codes
    `),
  ]);

  const liste = (r: any) => r.results ?? [];

  // Stunden lückenlos von 0 bis 23 — sonst fehlen im Diagramm die stillen
  // Stunden und die Balken rutschen durcheinander.
  const proStunde = (rows: any[]) => {
    const voll = Array.from({ length: 24 }, (_, h) => ({ stunde: h, n: 0 }));
    for (const r of rows) if (r.stunde >= 0 && r.stunde < 24) voll[r.stunde].n = r.n;
    return voll;
  };

  return Response.json({
    eckdaten:    liste(eckdaten)[0] ?? {},
    anmeldungen: proStunde(liste(stunden)),
    monate:      liste(monate),
    sprachen:    liste(sprachen),
    fraktionen:  liste(fraktionen),
    server:      liste(server),
    rechner:     liste(rechner),
    chat: {
      stunden: proStunde(liste(chatStunden)),
      tage:    liste(chatTage),
    },
    neueste:  liste(neueste),
    aktivste: liste(aktivste),
    meldungen: liste(meldungen)[0]?.offen ?? 0,
    codes:     liste(codes)[0] ?? { wartend: 0, aktiv: 0 },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
