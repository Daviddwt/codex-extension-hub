import type { CatalogResponse, RecommendationResponse, WatchStatus } from './types';

export async function getCatalog(): Promise<CatalogResponse> {
  const response = await fetch('/api/extensions');
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function rescanCatalog(): Promise<CatalogResponse> {
  const response = await fetch('/api/rescan', { method: 'POST' });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function runPluginUpdate(dryRun = false): Promise<unknown> {
  const response = await fetch('/api/plugin-updates/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function patchOverride(id: string, patch: Record<string, unknown>): Promise<CatalogResponse> {
  const response = await fetch(`/api/extensions/${id}/override`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function openPath(path: string): Promise<void> {
  const response = await fetch('/api/open-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function getWatchStatus(): Promise<WatchStatus> {
  const response = await fetch('/api/watch-status');
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export async function recommendExtensions(task: string): Promise<RecommendationResponse> {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body.error || response.statusText;
  } catch {
    return response.statusText;
  }
}
