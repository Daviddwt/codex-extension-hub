import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathExists, unique } from './safety.mjs';
import { readJson, readToml } from './metadata.mjs';

export async function loadCatalogConfig(cwd, warnings = []) {
  const file = path.join(cwd, 'catalog.config.json');
  const data = await readJson(file, warnings);
  return {
    projectRoots: unique([...(data?.projectRoots || []), cwd]),
    maxDepth: Number(data?.maxDepth || 4),
    includeAdminSkills: data?.includeAdminSkills !== false,
    includePluginCache: data?.includePluginCache !== false
  };
}

export async function loadOverrides(cwd, warnings = []) {
  return (await readJson(path.join(cwd, 'catalog.overrides.json'), warnings)) || {};
}

export async function discoverProjectRoots(config, codexConfig, warnings = []) {
  const roots = new Set();
  for (const root of config.projectRoots) {
    if (await pathExists(root)) roots.add(root);
    else warnings.push(`项目根目录不存在: ${root}`);
  }
  for (const candidate of commonProjectContainers()) {
    if (await pathExists(candidate)) {
      const projects = await findGitProjects(candidate, Math.min(config.maxDepth, 2));
      for (const project of projects) roots.add(project);
    }
  }
  for (const projectPath of Object.keys(codexConfig?.projects || {})) {
    if (await pathExists(projectPath)) roots.add(projectPath);
  }
  return [...roots];
}

function commonProjectContainers() {
  const home = os.homedir();
  return ['Projects', 'Developer', 'Code', 'workspace', 'Workspace'].map((name) => path.join(home, name));
}

export async function findGitProjects(root, maxDepth = 4) {
  const found = new Set();
  const seen = new Set();
  const skip = new Set(['node_modules', '.git', 'Library', '.Trash', 'dist', '.next']);
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let real = dir;
    try {
      real = await fs.realpath(dir);
    } catch {
      return;
    }
    if (seen.has(real)) return;
    seen.add(real);
    if (await pathExists(path.join(dir, '.git'))) {
      found.add(dir);
      return;
    }
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || skip.has(entry.name) || entry.name.startsWith('.')) continue;
      await walk(path.join(dir, entry.name), depth + 1);
    }
  }
  await walk(root, 0);
  if (!found.size && await pathExists(root)) found.add(root);
  return [...found];
}

export async function loadCodexConfig(warnings = []) {
  const file = path.join(os.homedir(), '.codex/config.toml');
  if (!(await pathExists(file))) return {};
  return (await readToml(file, warnings)) || {};
}

export function projectInfo(projectRoot) {
  return {
    projectName: path.basename(projectRoot),
    projectRoot
  };
}
