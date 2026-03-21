// GET /api/files/:key — public R2 proxy
export async function onRequestGet(ctx: any) {
  const { FILES } = ctx.env;
  const key = ctx.params.path;

  if (!key) return new Response('Not Found', { status: 404 });

  const validKey = Array.isArray(key) ? key.join('/') : key;
  if (!validKey.startsWith('rewards/')) {
    return new Response('Not Found', { status: 404 });
  }

  const object = await FILES.get(validKey);
  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new Response(object.body, { headers });
}
