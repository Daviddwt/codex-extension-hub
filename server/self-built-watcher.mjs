import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanCatalog } from './scanner/index.mjs';
import { discoverProjectRoots, loadCatalogConfig, loadCodexConfig, projectInfo } from './scanner/discovery.mjs';
import { pathExists, realPathSafe } from './scanner/safety.mjs';

const DEFAULT_DEBOUNCE_MS = 1200;
const WATCH_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.toml']);
const WATCH_FILENAMES = new Set(['SKILL.md', 'README.md', 'plugin.json', 'metadata.json', 'marketplace.json', '.mcp.json', '.app.json', 'hooks.json', 'config.toml']);
const IGNORED_PARTS = new Set(['node_modules', '.git', 'dist', '.next', '.vite', '__pycache__']);

export async function createSelfBuiltWatcher(cwd = process.cwd(), options = {}) {
  const listeners = new Set();
  const state = {
    enabled: false,
    status: 'starting',
    watched: [],
    lastEventAt: '',
    lastScanAt: '',
    lastError: '',
    note: '本地服务运行期间监听自建 Skill / Plugin 元数据变化；不执行扩展脚本。'
  };
  const watchers = [];
  let debounceTimer = null;
  let scanning = false;
  let queuedReason = '';
  const debounceMs = Number(options.debounceMs || DEFAULT_DEBOUNCE_MS);

  function emit(type, payload = {}) {
    const event = {
      type,
      at: new Date().toISOString(),
      ...payload
    };
    for (const listener of listeners) listener(event);
  }

  function snapshot() {
    return { ...state, watched: [...state.watched] };
  }

  async function runScan(reason) {
    if (scanning) {
      queuedReason = reason;
      return;
    }
    scanning = true;
    state.status = 'scanning';
    state.lastEventAt = new Date().toISOString();
    state.lastError = '';
    emit('watch-status', { status: snapshot() });
    try {
      const catalog = await scanCatalog(cwd);
      state.status = 'watching';
      state.lastScanAt = catalog.generatedAt;
      emit('catalog-updated', {
        reason,
        generatedAt: catalog.generatedAt,
        summary: catalog.summary
      });
      emit('watch-status', { status: snapshot() });
    } catch (error) {
      state.status = 'error';
      state.lastError = error instanceof Error ? error.message : String(error);
      emit('catalog-update-failed', { reason, error: state.lastError });
      emit('watch-status', { status: snapshot() });
    } finally {
      scanning = false;
      if (queuedReason) {
        const nextReason = queuedReason;
        queuedReason = '';
        scheduleScan(nextReason);
      }
    }
  }

  function scheduleScan(reason) {
    if (debounceTimer) clearTimeout(debounceTimer);
    state.lastEventAt = new Date().toISOString();
    state.status = scanning ? 'scanning' : 'pending';
    emit('watch-status', { status: snapshot() });
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      runScan(reason);
    }, debounceMs);
  }

  function watchTarget(target) {
    try {
      const watcher = fs.watch(target.path, { recursive: target.recursive }, (_eventType, filename) => {
        if (!isRelevantSelfBuiltChange(filename || target.path)) return;
        scheduleScan(`${target.label}: ${filename || path.basename(target.path)}`);
      });
      watcher.on('error', (error) => {
        state.lastError = error.message;
        emit('catalog-update-failed', { reason: target.label, error: error.message });
      });
      watchers.push(watcher);
      state.watched.push({
        label: target.label,
        path: target.path,
        recursive: target.recursive
      });
      return true;
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      return false;
    }
  }

  return {
    async start() {
      if (state.enabled) return snapshot();
      const targets = await collectSelfBuiltWatchTargets(cwd);
      for (const target of targets) watchTarget(target);
      state.enabled = state.watched.length > 0;
      state.status = state.enabled ? 'watching' : 'disabled';
      emit('watch-status', { status: snapshot() });
      return snapshot();
    },
    stop() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      for (const watcher of watchers.splice(0)) watcher.close();
      state.enabled = false;
      state.status = 'stopped';
      emit('watch-status', { status: snapshot() });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    snapshot
  };
}

export async function collectSelfBuiltWatchTargets(cwd = process.cwd()) {
  const warnings = [];
  const config = await loadCatalogConfig(cwd, warnings);
  const codexConfig = await loadCodexConfig(warnings);
  const projectRoots = await discoverProjectRoots(config, codexConfig, warnings);
  const candidates = [
    { label: '用户级自建 Skills', path: path.join(os.homedir(), '.agents/skills'), recursive: true },
    { label: '用户级自建 Plugin Marketplace', path: path.join(os.homedir(), '.agents/plugins/marketplace.json'), recursive: false },
    { label: '用户级自建 Plugin 源目录', path: path.join(os.homedir(), '.agents/plugins/plugins'), recursive: true },
    { label: 'Codex 本地 Plugin 缓存', path: path.join(os.homedir(), '.codex/plugins/cache/local-plugins'), recursive: true }
  ];

  for (const projectRoot of projectRoots) {
    const info = projectInfo(projectRoot);
    candidates.push(
      { label: `${info.projectName} 项目 Skills`, path: path.join(projectRoot, '.agents/skills'), recursive: true },
      { label: `${info.projectName} 项目 Plugin Marketplace`, path: path.join(projectRoot, '.agents/plugins/marketplace.json'), recursive: false },
      { label: `${info.projectName} Claude Plugin Marketplace`, path: path.join(projectRoot, '.claude-plugin/marketplace.json'), recursive: false },
      { label: `${info.projectName} 项目 MCP 配置`, path: path.join(projectRoot, '.codex/config.toml'), recursive: false }
    );
  }

  return dedupeTargets(await existingWatchTargets(candidates));
}

async function existingWatchTargets(candidates) {
  const results = [];
  for (const candidate of candidates) {
    const target = await normalizeWatchTarget(candidate);
    if (target) results.push(target);
  }
  return results;
}

async function normalizeWatchTarget(candidate) {
  if (await pathExists(candidate.path)) {
    const stat = await fsp.stat(candidate.path);
    return {
      ...candidate,
      path: await realPathSafe(candidate.path),
      recursive: candidate.recursive && stat.isDirectory()
    };
  }
  const parent = path.dirname(candidate.path);
  if (!(await pathExists(parent))) return null;
  return {
    ...candidate,
    label: `${candidate.label} 父目录`,
    path: await realPathSafe(parent),
    recursive: false
  };
}

function dedupeTargets(targets) {
  const seen = new Set();
  const deduped = [];
  for (const target of targets) {
    const key = `${target.path}:${target.recursive ? 'r' : 'f'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(target);
  }
  return deduped;
}

export function isRelevantSelfBuiltChange(filename) {
  if (!filename) return true;
  const parts = String(filename).split(/[\\/]+/).filter(Boolean);
  if (parts.some((part) => IGNORED_PARTS.has(part))) return false;
  const base = parts.at(-1) || '';
  if (!base || base === '.DS_Store' || base.endsWith('~')) return false;
  if (WATCH_FILENAMES.has(base)) return true;
  if (parts.includes('skills') || parts.includes('plugins') || parts.includes('hooks') || parts.includes('agents')) {
    return WATCH_EXTENSIONS.has(path.extname(base));
  }
  return false;
}
