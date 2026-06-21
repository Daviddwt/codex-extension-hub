import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export const HOME = os.homedir();

const SENSITIVE_KEY = /(token|secret|password|api[_-]?key|authorization|cookie|bearer|headers|http[_-]?headers|env)/i;
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]+|gh[pousr]_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{20,})/i;

export function isSensitiveKey(key = '') {
  return SENSITIVE_KEY.test(key);
}

export function redactText(value = '') {
  return String(value).replace(SENSITIVE_VALUE, '[REDACTED]');
}

export function redactValue(key, value) {
  if (isSensitiveKey(key)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value);
    }
    return '[REDACTED]';
  }
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (value && typeof value === 'object') return redactObject(value);
  return value;
}

export function redactObject(input) {
  if (!input || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((item) => redactObject(item));
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, redactValue(key, value)]));
}

export function compactHome(filePath) {
  if (!filePath) return '';
  return filePath.startsWith(HOME) ? `~${filePath.slice(HOME.length)}` : filePath;
}

export async function realPathSafe(targetPath) {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return targetPath;
  }
}

export async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function isPathInside(candidate, root) {
  const rel = path.relative(root, candidate);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

export function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
