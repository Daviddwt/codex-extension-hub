import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createApiRouter } from './api.mjs';
import { createSelfBuiltWatcher } from './self-built-watcher.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 5173);
const hmrPort = Number(process.env.HMR_PORT || port + 20000);
const cwd = process.cwd();
const app = express();
const watcher = await createSelfBuiltWatcher(cwd);
await watcher.start();

app.use('/api', createApiRouter(cwd, { watcher }));

const vite = await createViteServer({
  server: { middlewareMode: true, host, hmr: { host, port: hmrPort } },
  appType: 'spa'
});
app.use(vite.middlewares);

app.listen(port, host, () => {
  console.log(`Codex Extension Hub: http://${host}:${port}`);
});
