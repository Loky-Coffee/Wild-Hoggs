import { getToken } from '../../_lib/auth';

export async function onRequestPost(ctx: any) {
  const { DB } = ctx.env;
  const token = getToken(ctx.request);

  if (token) {
    await DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  return Response.json({ success: true });
}
