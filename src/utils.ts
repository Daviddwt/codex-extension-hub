import type { ExtensionItem, ViewMode } from './types';

export const TYPES = ['Plugin', 'Skill', 'MCP', 'App', 'Hook'] as const;

export function formatTime(value: string) {
  if (!value) return '尚未扫描';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

export function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

export function uniqueValues(items: ExtensionItem[], pick: (item: ExtensionItem) => string) {
  return [...new Set(items.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

export function groupBy(items: ExtensionItem[], mode: ViewMode) {
  const pick = {
    project: (item: ExtensionItem) => item.projectName || item.scope || '未归属项目',
    category: (item: ExtensionItem) => item.category || '其他',
    plugin: (item: ExtensionItem) => item.parentPlugin || (item.type === 'Plugin' ? item.name : '独立扩展')
  }[mode];
  const groups = new Map<string, ExtensionItem[]>();
  if (!pick) return groups;
  for (const item of items) {
    const key = pick(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }
  return groups;
}

export function matchSearch(item: ExtensionItem, query: string) {
  if (!query.trim()) return true;
  const haystack = [
    item.name,
    item.displayName,
    item.invokeName,
    item.purposeZh,
    item.descriptionOriginal,
    item.useCases.join(' '),
    item.basicPrompt,
    item.examplePrompts.join(' '),
    item.category,
    item.projectName,
    item.projectRoot,
    item.sourcePath,
    item.marketplace,
    item.parentPlugin,
    item.tags?.join(' '),
    item.notes
  ].join(' ').toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}
