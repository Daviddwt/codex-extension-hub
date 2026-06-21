import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import YAML from 'yaml';
import TOML from '@iarna/toml';
import { pathExists, realPathSafe, redactText, unique } from './safety.mjs';

export async function readText(filePath, warnings = []) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    warnings.push(`无法读取 ${filePath}: ${error.message}`);
    return '';
  }
}

export async function readJson(filePath, warnings = []) {
  const text = await readText(filePath, warnings);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    warnings.push(`JSON 解析失败 ${filePath}: ${error.message}`);
    return null;
  }
}

export async function readYaml(filePath, warnings = []) {
  const text = await readText(filePath, warnings);
  if (!text) return null;
  try {
    return YAML.parse(text);
  } catch (error) {
    warnings.push(`YAML 解析失败 ${filePath}: ${error.message}`);
    return null;
  }
}

export async function readToml(filePath, warnings = []) {
  const text = await readText(filePath, warnings);
  if (!text) return null;
  try {
    return TOML.parse(text);
  } catch (error) {
    warnings.push(`TOML 解析失败 ${filePath}: ${error.message}`);
    return null;
  }
}

export function parseFrontmatter(markdown = '') {
  if (!markdown.startsWith('---')) return { data: {}, body: markdown };
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: markdown };
  const raw = markdown.slice(3, end).trim();
  const body = markdown.slice(end + 4);
  try {
    return { data: YAML.parse(raw) || {}, body };
  } catch {
    return { data: {}, body };
  }
}

export function firstMarkdownParagraph(markdown = '') {
  const clean = markdown
    .replace(/^---[\s\S]*?\n---/, '')
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('|') && !line.startsWith('- '));
  return clean[0] || '';
}

export async function listDirs(root) {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.')).map((entry) => path.join(root, entry.name));
  } catch {
    return [];
  }
}

export async function listFilesRecursive(root, matcher, options = {}) {
  const maxDepth = options.maxDepth ?? 6;
  const ignore = new Set(['node_modules', '.git', '.DS_Store', 'dist', '.next']);
  const output = [];
  const seen = new Set();
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    const real = await realPathSafe(dir);
    if (seen.has(real)) return;
    seen.add(real);
    let entries = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignore.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full, depth + 1);
      else if (matcher(full)) output.push(full);
    }
  }
  await walk(root, 0);
  return output;
}

export async function latestMtime(paths) {
  const times = [];
  for (const item of paths.filter(Boolean)) {
    try {
      const stat = await fs.stat(item);
      times.push(stat.mtimeMs);
    } catch {
      // Ignore missing optional metadata files.
    }
  }
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export function stableId(parts) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

export function normalizePrompt(prompt) {
  if (Array.isArray(prompt)) return prompt.find(Boolean) || '';
  return prompt || '';
}

export function sourceText(...values) {
  return values.flat().filter(Boolean).map((item) => redactText(String(item))).join(' ').trim();
}

export async function childNames(root) {
  const dirs = await listDirs(root);
  return dirs.map((dir) => path.basename(dir));
}

export async function hasAny(root, names) {
  const found = [];
  for (const name of names) {
    const full = path.join(root, name);
    if (await pathExists(full)) found.push(full);
  }
  return unique(found);
}
