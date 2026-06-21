import express from 'express';
import path from 'node:path';
import { createApiRouter } from './api.mjs';
import { createSelfBuiltWatcher } from './self-built-watcher.mjs';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const cwd = process.cwd();
const app = express();
const watcher = await createSelfBuiltWatcher(cwd);
await watcher.start();

app.use('/api', createApiRouter(cwd, { watcher }));
app.use(express.static(path.join(cwd, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(cwd, 'dist/index.html')));

app.listen(port, host, () => {
  console.log(`Codex Extension Hub preview: http://${host}:${port}`);
});
