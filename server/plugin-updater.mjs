import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { scanCatalog } from './scanner/index.mjs';
import { redactText } from './scanner/safety.mjs';

const MANAGED_MARKETPLACES = new Set(['local-plugins', 'openai-bundled', 'openai-primary-runtime']);

export async function updateThirdPartyPlugins(cwd = process.cwd(), options = {}) {
  const startedAt = new Date().toISOString();
  const dryRun = options.dryRun === true;
  const records = [];
  const commands = [];

  const beforeList = await runJsonCommand('codex', ['plugin', 'list', '--json'], cwd);
  commands.push(commandRecord('codex plugin list --json', beforeList));
  const beforeInstalled = beforeList.json?.installed || [];

  const upgradeResult = dryRun
    ? { code: 0, stdout: 'dry-run: skipped marketplace upgrade', stderr: '' }
    : await runCommand('codex', ['plugin', 'marketplace', 'upgrade'], cwd);
  commands.push(commandRecord('codex plugin marketplace upgrade', upgradeResult));

  for (const plugin of beforeInstalled) {
    const classification = classifyPluginForUpdate(plugin);
    if (!classification.shouldUpdate) {
      records.push(toRecord(plugin, {
        status: classification.status,
        message: classification.message,
        beforeVersion: plugin.version || '',
        afterVersion: plugin.version || '',
        checkedAt: startedAt
      }));
      continue;
    }

    const selector = plugin.pluginId || `${plugin.name}@${plugin.marketplaceName}`;
    const addResult = dryRun
      ? { code: 0, stdout: `dry-run: would run codex plugin add ${selector}`, stderr: '' }
      : await runCommand('codex', ['plugin', 'add', selector], cwd);
    commands.push(commandRecord(`codex plugin add ${selector}`, addResult));

    records.push(toRecord(plugin, {
      status: addResult.code === 0 ? 'checked' : 'failed',
      message: addResult.code === 0 ? '已执行第三方插件更新检查' : `更新失败: ${summarizeOutput(addResult)}`,
      beforeVersion: plugin.version || '',
      afterVersion: plugin.version || '',
      checkedAt: startedAt
    }));
  }

  const afterList = await runJsonCommand('codex', ['plugin', 'list', '--json'], cwd);
  commands.push(commandRecord('codex plugin list --json', afterList));
  const afterById = new Map((afterList.json?.installed || []).map((plugin) => [plugin.pluginId, plugin]));

  for (const record of records) {
    const after = afterById.get(record.pluginId);
    if (!after) continue;
    record.afterVersion = after.version || record.afterVersion;
    if (record.status === 'checked') {
      record.status = record.beforeVersion && record.afterVersion && record.beforeVersion !== record.afterVersion ? 'updated' : 'checked-no-change';
      record.message = record.status === 'updated'
        ? `已更新：${record.beforeVersion || '未知'} -> ${record.afterVersion || '未知'}`
        : `已检查，无版本变化：${record.afterVersion || '未知'}`;
    }
  }

  const report = {
    generatedAt: startedAt,
    mode: dryRun ? 'dry-run' : 'apply',
    policy: {
      included: ['openai-curated', 'openai-curated-remote'],
      skipped: ['local-plugins', 'openai-bundled', 'openai-primary-runtime'],
      note: '只更新非自建、非系统运行时的 marketplace 插件；不会执行 Plugin、Skill、Hook 或 MCP 脚本。'
    },
    summary: summarizeRecords(records),
    records,
    commands
  };

  await fs.mkdir(path.join(cwd, 'data'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'data/plugin-updates.json'), JSON.stringify(report, null, 2));
  await scanCatalog(cwd);
  return report;
}

export async function loadPluginUpdateReport(cwd = process.cwd()) {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, 'data/plugin-updates.json'), 'utf8'));
  } catch {
    return null;
  }
}

export function classifyPluginForUpdate(plugin) {
  const marketplace = plugin.marketplaceName || '';
  if (marketplace === 'local-plugins') {
    return { shouldUpdate: false, status: 'skipped-self-built', message: '自建/local 插件，按策略跳过自动更新' };
  }
  if (marketplace === 'openai-bundled' || marketplace === 'openai-primary-runtime') {
    return { shouldUpdate: false, status: 'skipped-managed', message: '系统或运行时托管插件，按策略跳过' };
  }
  if (MANAGED_MARKETPLACES.has(marketplace)) {
    return { shouldUpdate: false, status: 'skipped-managed', message: '受管理 marketplace，按策略跳过' };
  }
  return { shouldUpdate: true, status: 'pending', message: '第三方 marketplace 插件，纳入检查更新' };
}

function toRecord(plugin, extra) {
  return {
    pluginId: plugin.pluginId || `${plugin.name}@${plugin.marketplaceName}`,
    name: plugin.name || '',
    marketplaceName: plugin.marketplaceName || '',
    sourceType: plugin.source?.source || '',
    sourcePath: plugin.source?.path || '',
    installed: plugin.installed === true,
    enabled: plugin.enabled !== false,
    beforeVersion: extra.beforeVersion,
    afterVersion: extra.afterVersion,
    status: extra.status,
    message: extra.message,
    checkedAt: extra.checkedAt,
    updatedAt: extra.status === 'updated' ? extra.checkedAt : ''
  };
}

function summarizeRecords(records) {
  return {
    total: records.length,
    candidates: records.filter((record) => ['updated', 'checked-no-change', 'checked', 'failed'].includes(record.status)).length,
    updated: records.filter((record) => record.status === 'updated').length,
    checkedNoChange: records.filter((record) => record.status === 'checked-no-change').length,
    failed: records.filter((record) => record.status === 'failed').length,
    skippedSelfBuilt: records.filter((record) => record.status === 'skipped-self-built').length,
    skippedManaged: records.filter((record) => record.status === 'skipped-managed').length
  };
}

function commandRecord(command, result) {
  return {
    command,
    code: result.code,
    stdout: summarizeOutputText(result.stdout),
    stderr: summarizeOutputText(result.stderr)
  };
}

function summarizeOutput(result) {
  return summarizeOutputText(`${result.stderr || ''}\n${result.stdout || ''}`.trim());
}

function summarizeOutputText(text = '') {
  const clean = redactText(String(text)).trim();
  return clean.length > 1600 ? `${clean.slice(0, 1600)}...` : clean;
}

async function runJsonCommand(command, args, cwd) {
  const result = await runCommand(command, args, cwd);
  try {
    return { ...result, json: JSON.parse(result.stdout || '{}') };
  } catch (error) {
    return { ...result, json: null, stderr: `${result.stderr}\nJSON 解析失败: ${error.message}`.trim() };
  }
}

async function runCommand(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: error.message }));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}
