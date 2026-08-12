import { getToken, validateSession } from '../../_lib/auth';
import { verlangt, saubereRechte, VORLAGEN, type Recht } from '../../_lib/permissions';

// GET /api/admin/users — Nutzerliste
//
// E-Mail-Adressen sehen ausschliesslich Administratoren. Wer die Liste zum
// Moderieren öffnet, braucht sie nicht.
export async function onRequestGet(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(user, 'users.view');
  if (nein) return nein;

  const { results } = await DB.prepare(
    `SELECT u.id, u.username, u.email, u.server, u.faction,
            u.is_admin, COALESCE(u.is_moderator, 0) AS is_moderator,
            u.permissions, u.created_at, u.last_seen,
            datetime(MAX(s.expires_at), '-30 days') AS last_login,
            (SELECT COUNT(*) FROM chat_global g WHERE g.user_id = u.id) AS msg_global,
            (SELECT COUNT(*) FROM chat_server v WHERE v.user_id = u.id) AS msg_server
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.id
     GROUP BY u.id
     ORDER BY u.is_admin DESC, COALESCE(u.is_moderator, 0) DESC, u.username ASC`
  ).all();

  // E-Mail-Adressen sehen nur Administratoren.
  //
  // Vorher hing das an 'users.roles'. Da beide Änderungspfade unten zusätzlich
  // is_admin verlangen, konnte ein Moderator mit diesem Recht nichts tun —
  // ausser die vollständige Adressliste aller Konten zu sehen. Wer es in gutem
  // Glauben vergab, gab damit personenbezogene Daten heraus und bekam keinerlei
  // Funktion dafür.
  const users = (results ?? []).map((u: any) =>
    user.is_admin === 1 ? u : { ...u, email: null }
  );

  // Enthält personenbezogene Daten — gehört in keinen Zwischenspeicher.
  return Response.json({ users }, { headers: { 'Cache-Control': 'no-store' } });
}

// PATCH /api/admin/users — Rolle und Rechte eines Kontos setzen
//
// Erwartet { user_id, role? , permissions? } oder { user_id, template }.
// Rolle und Rechte lassen sich zusammen oder einzeln ändern.
export async function onRequestPatch(ctx: any) {
  const { DB } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });

  const nein = verlangt(user, 'users.roles');
  if (nein) return nein;

  let body: any;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'Ungültiges JSON' }, { status: 400 });
  }

  const { user_id, role, permissions, template } = body ?? {};

  if (!user_id || typeof user_id !== 'string') {
    return Response.json({ error: 'user_id erforderlich' }, { status: 400 });
  }
  if (user_id === user.user_id) {
    return Response.json({ error: 'Eigenen Status nicht änderbar' }, { status: 400 });
  }

  // Rechte dürfen nur Administratoren vergeben. Sonst könnte sich jemand mit
  // 'users.roles' selbst zum Vollzugriff verhelfen, indem er ein zweites Konto
  // ausstattet und sich dort anmeldet.
  const nurAdmin = (was: string) =>
    Response.json({ error: `${was} darf nur ein Administrator ändern` }, { status: 403 });

  // ── Rolle ────────────────────────────────────────────────────────────────
  const felder: string[] = [];
  const werte: any[] = [];

  if (role !== undefined) {
    if (!['user', 'moderator', 'admin'].includes(role)) {
      return Response.json({ error: 'role muss user, moderator oder admin sein' }, { status: 400 });
    }
    if (user.is_admin !== 1) return nurAdmin('Die Rolle');
    felder.push('is_admin = ?', 'is_moderator = ?');
    werte.push(role === 'admin' ? 1 : 0, role === 'moderator' ? 1 : 0);
  }

  // ── Rechte ───────────────────────────────────────────────────────────────
  let liste: Recht[] | null = null;
  if (template !== undefined) {
    if (!(template in VORLAGEN)) {
      return Response.json({ error: 'Unbekannte Vorlage' }, { status: 400 });
    }
    liste = VORLAGEN[template];
  } else if (permissions !== undefined) {
    liste = saubereRechte(permissions);
  }

  if (liste !== null) {
    if (user.is_admin !== 1) return nurAdmin('Rechte');
    felder.push('permissions = ?');
    werte.push(JSON.stringify(liste));
  }

  if (felder.length === 0) {
    return Response.json({ error: 'Nichts zu ändern' }, { status: 400 });
  }

  werte.push(user_id);
  const geaendert = await DB.prepare(
    `UPDATE users SET ${felder.join(', ')} WHERE id = ?
     RETURNING id, username, is_admin, is_moderator, permissions`
  ).bind(...werte).first();

  if (!geaendert) return Response.json({ error: 'Konto nicht gefunden' }, { status: 404 });

  return Response.json({ success: true, user: geaendert });
}
