import { Hono } from 'hono';
import type { Context } from 'hono';
import { issueSession } from './auth';
import { authMiddleware } from './auth';
import type { Env } from './types';
import { createSong, getTask, listSongs } from './routes';
import { getAudio } from './audio';

export const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => c.json({ ok: true }));

// single shared password → signed session cookie
app.post('/api/auth', async (c: Context<{ Bindings: Env }>) => {
  let body: { password?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  if (typeof body.password !== 'string' || body.password !== c.env.APP_PASSWORD) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await issueSession(c);
  return c.json({ ok: true });
});

// all protected routes require a valid signed cookie
app.use('/api/*', authMiddleware);
app.use('/audio/*', authMiddleware);

app.post('/api/generate', createSong);
app.get('/api/tasks/:id', getTask);
app.get('/api/songs', listSongs);
// audio route also sits behind authMiddleware (path starts with /audio, not exempted)
app.get('/audio/:key', getAudio);

export default { fetch: app.fetch };
