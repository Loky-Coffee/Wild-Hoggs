import { getToken, validateSession } from '../../_lib/auth';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png':  'png',
};

// POST /api/admin/upload — admin only, multipart/form-data, field "file"
export async function onRequestPost(ctx: any) {
  const { DB, FILES } = ctx.env;

  const token = getToken(ctx.request);
  if (!token) return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });

  const user = await validateSession(DB, token);
  if (!user) return Response.json({ error: 'Sitzung abgelaufen' }, { status: 401 });
  if (user.is_admin !== 1) return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });

  let formData: FormData;
  try {
    formData = await ctx.request.formData();
  } catch {
    return Response.json({ error: 'Ungültige Formulardaten' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: 'Kein Bild hochgeladen (Feld "file" fehlt)' }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return Response.json({ error: 'Nur WebP, JPEG und PNG sind erlaubt' }, { status: 415 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'Datei ist zu groß (max. 5 MB)' }, { status: 413 });
  }

  const buffer = await file.arrayBuffer();
  const key = `rewards/${crypto.randomUUID()}.${ext}`;

  await FILES.put(key, buffer, {
    httpMetadata: { contentType: file.type },
  });

  return Response.json({ key });
}
