import express from 'express';
import { loadCatalog, openSafePath, scanCatalog, updateOverride } from './scanner/index.mjs';
import { loadPluginUpdateReport, updateThirdPartyPlugins } from './plugin-updater.mjs';
import { recommendExtensions } from './recommender.mjs';

export function createApiRouter(cwd, { watcher } = {}) {
  const router = express.Router();
  router.use(express.json({ limit: '256kb' }));

  router.get('/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    function send(event) {
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    send({
      type: 'watch-status',
      at: new Date().toISOString(),
      status: watcher?.snapshot ? watcher.snapshot() : disabledWatchStatus()
    });

    const unsubscribe = watcher?.subscribe ? watcher.subscribe(send) : null;
    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 25000);

    req.on('close', () => {
      clearInterval(keepAlive);
      if (unsubscribe) unsubscribe();
      res.end();
    });
  });

  router.get('/watch-status', (_req, res) => {
    res.json(watcher?.snapshot ? watcher.snapshot() : disabledWatchStatus());
  });

  router.get('/extensions', async (_req, res) => {
    try {
      res.json(await loadCatalog(cwd));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/recommendations', async (req, res) => {
    try {
      const task = String(req.body?.task || '').trim();
      if (!task) {
        res.status(400).json({ error: '请输入要完成的事情。' });
        return;
      }
      res.json(await recommendExtensions(cwd, task));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/rescan', async (_req, res) => {
    try {
      res.json(await scanCatalog(cwd));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/plugin-updates', async (_req, res) => {
    try {
      res.json(await loadPluginUpdateReport(cwd));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/plugin-updates/run', async (req, res) => {
    try {
      res.json(await updateThirdPartyPlugins(cwd, { dryRun: req.body?.dryRun === true }));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/extensions/:id/override', async (req, res) => {
    try {
      res.json(await updateOverride(cwd, req.params.id, req.body || {}));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/open-path', async (req, res) => {
    try {
      await openSafePath(cwd, req.body?.path || '');
      res.json({ ok: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  return router;
}

function disabledWatchStatus() {
  return {
    enabled: false,
    status: 'disabled',
    watched: [],
    note: '当前 API 服务未启用自建扩展文件监听。'
  };
}
