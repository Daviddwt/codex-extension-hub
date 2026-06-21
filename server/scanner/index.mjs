import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import {
  childNames,
  firstMarkdownParagraph,
  hasAny,
  latestMtime,
  listDirs,
  listFilesRecursive,
  normalizePrompt,
  parseFrontmatter,
  readJson,
  readText,
  readToml,
  readYaml,
  stableId,
  sourceText
} from './metadata.mjs';
import { compactHome, pathExists, realPathSafe, redactObject, unique } from './safety.mjs';
import { discoverProjectRoots, loadCatalogConfig, loadCodexConfig, loadOverrides, projectInfo } from './discovery.mjs';
import { examplePromptsFor, inferPurpose, inferUseCases, normalizeCategory, promptFor } from './classify.mjs';

const EXTENSION_TYPES = ['Plugin', 'Skill', 'MCP', 'App', 'Hook'];

export async function scanCatalog(cwd = process.cwd()) {
  const warnings = [];
  const config = await loadCatalogConfig(cwd, warnings);
  const overrides = await loadOverrides(cwd, warnings);
  const codexConfig = await loadCodexConfig(warnings);
  const pluginUpdateReport = await loadPluginUpdateReport(cwd);
  const projectRoots = await discoverProjectRoots(config, codexConfig, warnings);
  const marketplaces = await scanMarketplaces(projectRoots, warnings);
  const pluginEnabled = readPluginEnabled(codexConfig);
  const extensions = [];
  const scanSources = [];

  scanSources.push(sourceRecord('全局 Codex 配置', path.join(os.homedir(), '.codex/config.toml'), await pathExists(path.join(os.homedir(), '.codex/config.toml'))));

  await scanSkillRoot(path.join(os.homedir(), '.agents/skills'), { scope: '全局/用户级', source: '个人', componentType: '独立扩展' }, extensions, scanSources);

  if (config.includeAdminSkills) {
    await scanSkillRoot('/etc/codex/skills', { scope: '管理员级', source: '管理员', componentType: '独立扩展' }, extensions, scanSources);
  }

  for (const projectRoot of projectRoots) {
    const info = projectInfo(projectRoot);
    await scanProjectSkillRoots(projectRoot, info, extensions, scanSources);
    await scanProjectMcp(projectRoot, info, extensions, scanSources, warnings);
  }

  await scanConfiguredMcp(codexConfig, extensions, scanSources, warnings);

  if (config.includePluginCache) {
    await scanPlugins(path.join(os.homedir(), '.codex/plugins/cache'), marketplaces, pluginEnabled, extensions, scanSources, warnings);
  }

  markDuplicateNames(extensions);
  const merged = extensions.map((entry) => applyOverride(finalizeEntry(applyPluginUpdate(entry, pluginUpdateReport)), overrides[entry.id]));
  const result = {
    generatedAt: new Date().toISOString(),
    coverageNote: '系统内置扩展可能无法通过本地文件完整扫描；本工具只展示已从本机配置、缓存、Skill 目录和 marketplace 中确认发现的扩展。',
    pluginUpdateReport,
    scanSources,
    warnings,
    summary: summarize(merged),
    extensions: merged
  };
  await fs.mkdir(path.join(cwd, 'data'), { recursive: true });
  await fs.writeFile(path.join(cwd, 'data/extensions.json'), JSON.stringify(result, null, 2));
  return result;
}

async function loadPluginUpdateReport(cwd) {
  try {
    return JSON.parse(await fs.readFile(path.join(cwd, 'data/plugin-updates.json'), 'utf8'));
  } catch {
    return null;
  }
}

export async function loadCatalog(cwd = process.cwd()) {
  const file = path.join(cwd, 'data/extensions.json');
  if (!(await pathExists(file))) return scanCatalog(cwd);
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function updateOverride(cwd, id, patch) {
  const file = path.join(cwd, 'catalog.overrides.json');
  const current = (await readJson(file, [])) || {};
  const allowed = ['displayName', 'purposeZh', 'category', 'basicPrompt', 'tags', 'notes', 'favorite'];
  const clean = {};
  for (const key of allowed) {
    if (key in patch) clean[key] = patch[key];
  }
  current[id] = { ...(current[id] || {}), ...clean, updatedAt: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(current, null, 2));
  return scanCatalog(cwd);
}

export async function openSafePath(cwd, requestedPath) {
  const catalog = await loadCatalog(cwd);
  const expanded = requestedPath.startsWith('~') ? path.join(os.homedir(), requestedPath.slice(1)) : requestedPath;
  const real = await realPathSafe(expanded);
  const allowed = new Set();
  for (const entry of catalog.extensions || []) {
    for (const item of [entry.sourcePath, entry.resolvedPath, entry.documentationPath, entry.projectRoot]) {
      if (item) allowed.add(await realPathSafe(item));
    }
  }
  if (!allowed.has(real)) {
    throw new Error('路径未出现在扫描结果中，已拒绝打开。');
  }
  await new Promise((resolve, reject) => {
    const child = spawn('open', [real], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`open 退出码 ${code}`)));
  });
}

async function scanSkillRoot(root, context, extensions, scanSources, parentPlugin = null) {
  const exists = await pathExists(root);
  scanSources.push(sourceRecord(parentPlugin ? `${parentPlugin} 内置 Skills` : 'Skill 目录', root, exists));
  if (!exists) return;
  const dirs = await listDirs(root);
  for (const dir of dirs) {
    const entry = await buildSkillEntry(dir, context, parentPlugin);
    if (entry) extensions.push(entry);
  }
}

async function scanProjectSkillRoots(projectRoot, info, extensions, scanSources) {
  const candidates = unique([
    path.join(projectRoot, '.agents/skills'),
    ...ancestorSkillRoots(projectRoot)
  ]);
  for (const root of candidates) {
    await scanSkillRoot(root, {
      scope: '项目级',
      source: '本地项目',
      projectName: info.projectName,
      projectRoot,
      componentType: '独立扩展'
    }, extensions, scanSources);
  }
}

function ancestorSkillRoots(start) {
  const roots = [];
  let current = start;
  while (current && current !== path.dirname(current)) {
    roots.push(path.join(current, '.agents/skills'));
    if (path.basename(current) === '.git') break;
    current = path.dirname(current);
  }
  return roots;
}

async function buildSkillEntry(skillDir, context, parentPlugin = null) {
  const warnings = [];
  const skillMd = path.join(skillDir, 'SKILL.md');
  const readme = path.join(skillDir, 'README.md');
  const openaiYaml = path.join(skillDir, 'agents/openai.yaml');
  const metadataJson = path.join(skillDir, 'metadata.json');
  const hasSkill = await pathExists(skillMd);
  const hasReadme = await pathExists(readme);
  const hasYaml = await pathExists(openaiYaml);
  const hasMetadata = await pathExists(metadataJson);
  if (!hasSkill && !hasReadme && !hasYaml && !hasMetadata) return null;
  if (!hasSkill) warnings.push('缺少 SKILL.md');
  const markdown = hasSkill ? await readText(skillMd, warnings) : '';
  const readmeText = hasReadme ? await readText(readme, warnings) : '';
  const frontmatter = parseFrontmatter(markdown);
  const yaml = hasYaml ? await readYaml(openaiYaml, warnings) : null;
  const metadata = hasMetadata ? await readJson(metadataJson, warnings) : null;
  const name = yaml?.name || yaml?.interface?.name || frontmatter.data?.name || metadata?.name || path.basename(skillDir);
  const displayName = yaml?.interface?.display_name || yaml?.interface?.displayName || metadata?.displayName || name;
  const descriptionOriginal = sourceText(
    yaml?.interface?.short_description,
    yaml?.description,
    metadata?.description,
    frontmatter.data?.description,
    firstMarkdownParagraph(readmeText),
    firstMarkdownParagraph(markdown)
  );
  const category = normalizeCategory(metadata?.category, `${name} ${descriptionOriginal}`);
  const invokeName = parentPlugin ? `${parentPlugin}:${name}` : name;
  const prompt = normalizePrompt(yaml?.interface?.default_prompt || metadata?.defaultPrompt);
  const resolvedPath = await realPathSafe(skillDir);
  return {
    id: stableId(['Skill', context.scope, context.projectRoot || '', skillDir, parentPlugin || '']),
    name,
    displayName,
    invokeName,
    invokeSyntax: `$${invokeName}`,
    type: 'Skill',
    componentType: parentPlugin ? 'Plugin 内置组件' : context.componentType,
    parentPlugin,
    scope: context.scope,
    projectName: context.projectName || '',
    projectRoot: context.projectRoot || '',
    sourcePath: skillDir,
    resolvedPath,
    marketplace: context.marketplace || '',
    source: context.source || '未知',
    version: metadata?.version || '',
    author: metadata?.author || '',
    enabled: context.enabled ?? true,
    status: warnings.length ? '元数据缺失' : '正常',
    descriptionOriginal,
    purposeZh: inferPurpose(category, descriptionOriginal, name),
    useCases: inferUseCases(category, 'Skill'),
    category,
    basicPrompt: promptFor('Skill', invokeName, category, prompt),
    examplePrompts: examplePromptsFor('Skill', invokeName, category, promptFor('Skill', invokeName, category, prompt)),
    promptSource: prompt ? '配置提供' : '自动整理',
    dependencies: await dependenciesForSkill(skillDir),
    bundledSkills: [],
    bundledMcpServers: [],
    bundledApps: [],
    bundledHooks: [],
    documentationPath: hasSkill ? skillMd : (hasReadme ? readme : ''),
    repository: metadata?.repository || '',
    homepage: metadata?.homepage || '',
    lastModified: await latestMtime([skillMd, readme, openaiYaml, metadataJson]),
    metadataSource: unique([hasYaml ? openaiYaml : '', hasSkill ? skillMd : '', hasReadme ? readme : '', hasMetadata ? metadataJson : '']),
    warnings
  };
}

async function dependenciesForSkill(skillDir) {
  const names = [];
  for (const folder of ['scripts', 'references', 'assets']) {
    if (await pathExists(path.join(skillDir, folder))) names.push(folder);
  }
  return names;
}

async function scanMarketplaces(projectRoots, warnings) {
  const results = [];
  const global = path.join(os.homedir(), '.agents/plugins/marketplace.json');
  await readMarketplace(global, { scope: '全局/用户级', source: '个人', projectName: '', projectRoot: '' }, results, warnings);
  for (const projectRoot of projectRoots) {
    const info = projectInfo(projectRoot);
    for (const rel of ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json']) {
      await readMarketplace(path.join(projectRoot, rel), { scope: '项目级', source: '本地项目', ...info }, results, warnings);
    }
  }
  return results;
}

async function readMarketplace(file, context, results, warnings) {
  if (!(await pathExists(file))) return;
  const data = await readJson(file, warnings);
  if (!data) return;
  const marketplaceName = data.name || path.basename(path.dirname(file));
  for (const plugin of data.plugins || []) {
    results.push({
      marketplace: marketplaceName,
      pluginName: plugin.name,
      file,
      plugin,
      ...context
    });
  }
}

function readPluginEnabled(codexConfig) {
  const enabled = new Map();
  for (const [key, value] of Object.entries(codexConfig?.plugins || {})) {
    enabled.set(key, value?.enabled !== false);
    const [name] = key.split('@');
    if (name) enabled.set(name, value?.enabled !== false);
  }
  return enabled;
}

async function scanPlugins(cacheRoot, marketplaces, pluginEnabled, extensions, scanSources, warnings) {
  const exists = await pathExists(cacheRoot);
  scanSources.push(sourceRecord('Codex Plugin 缓存', cacheRoot, exists));
  if (!exists) return;
  const manifests = await listFilesRecursive(cacheRoot, (file) => file.endsWith('/.codex-plugin/plugin.json'), { maxDepth: 5 });
  for (const manifestPath of manifests) {
    const pluginRoot = path.dirname(path.dirname(manifestPath));
    const manifestWarnings = [];
    const manifest = await readJson(manifestPath, manifestWarnings);
    if (!manifest) continue;
    const rel = path.relative(cacheRoot, pluginRoot).split(path.sep);
    const marketplace = rel[0] || '';
    const name = manifest.name || rel[1] || path.basename(pluginRoot);
    const marketplaceInfo = marketplaces.find((item) => item.pluginName === name && (item.marketplace === marketplace || !marketplace)) || null;
    const source = inferPluginSource(marketplace, marketplaceInfo);
    const scope = marketplaceInfo?.scope || inferPluginScope(marketplace);
    const enabledKey = `${name}@${marketplace}`;
    const enabled = pluginEnabled.has(enabledKey) ? pluginEnabled.get(enabledKey) : (pluginEnabled.has(name) ? pluginEnabled.get(name) : true);
    const info = {
      scope,
      source,
      marketplace,
      projectName: marketplaceInfo?.projectName || '',
      projectRoot: marketplaceInfo?.projectRoot || '',
      componentType: '独立扩展',
      enabled
    };
    const pluginEntry = await buildPluginEntry(pluginRoot, manifestPath, manifest, info, manifestWarnings);
    extensions.push(pluginEntry);
    await scanSkillRoot(path.join(pluginRoot, manifest.skills || 'skills'), {
      ...info,
      componentType: 'Plugin 内置组件',
      enabled,
      parentPlugin: name
    }, extensions, scanSources, name);
    await scanPluginMcp(pluginRoot, name, info, extensions, manifestWarnings);
    await scanPluginApps(pluginRoot, name, info, extensions, manifestWarnings);
    await scanPluginHooks(pluginRoot, name, info, extensions, manifestWarnings);
  }
}

function inferPluginScope(marketplace) {
  if (/openai|bundled|curated|primary-runtime/i.test(marketplace)) return '工作区级';
  if (/local|personal|user/i.test(marketplace)) return '全局/用户级';
  return '未知';
}

function inferPluginSource(marketplace, marketplaceInfo) {
  if (marketplaceInfo?.source) return marketplaceInfo.source;
  if (/openai|bundled|curated|primary-runtime/i.test(marketplace)) return '官方';
  if (/local|personal|user/i.test(marketplace)) return '个人';
  return '未知';
}

async function buildPluginEntry(root, manifestPath, manifest, context, warnings) {
  const displayName = manifest.interface?.displayName || manifest.displayName || manifest.name || path.basename(root);
  const name = manifest.name || displayName;
  const descriptionOriginal = sourceText(
    manifest.interface?.longDescription,
    manifest.interface?.shortDescription,
    manifest.longDescription,
    manifest.shortDescription,
    manifest.description
  );
  const category = normalizeCategory(manifest.interface?.category || manifest.category, `${name} ${descriptionOriginal}`);
  const bundledSkills = await childNames(path.join(root, manifest.skills || 'skills'));
  const bundledMcpServers = await mcpNames(path.join(root, '.mcp.json'), warnings);
  const bundledApps = await appNames(path.join(root, '.app.json'), warnings);
  const bundledHooks = await hookNames(path.join(root, 'hooks/hooks.json'), warnings);
  const basePrompt = promptFor('Plugin', name, category, normalizePrompt(manifest.interface?.defaultPrompt));
  return {
    id: stableId(['Plugin', context.marketplace, root, name]),
    name,
    displayName,
    invokeName: name,
    invokeSyntax: `@${name}`,
    type: 'Plugin',
    componentType: '独立扩展',
    parentPlugin: '',
    scope: context.scope,
    projectName: context.projectName,
    projectRoot: context.projectRoot,
    sourcePath: root,
    resolvedPath: await realPathSafe(root),
    marketplace: context.marketplace,
    source: context.source,
    version: manifest.version || '',
    author: manifest.author?.name || manifest.author || manifest.interface?.developerName || '',
    enabled: context.enabled,
    status: context.enabled ? (warnings.length ? '配置异常' : '正常') : '禁用',
    descriptionOriginal,
    purposeZh: inferPurpose(category, descriptionOriginal, name),
    useCases: inferUseCases(category, 'Plugin'),
    category,
    basicPrompt: basePrompt,
    examplePrompts: examplePromptsFor('Plugin', name, category, basePrompt),
    promptSource: manifest.interface?.defaultPrompt ? '官方提供' : '自动整理',
    dependencies: dependenciesFromManifest(manifest),
    bundledSkills,
    bundledMcpServers,
    bundledApps,
    bundledHooks,
    documentationPath: manifestPath,
    repository: manifest.repository || '',
    homepage: manifest.homepage || manifest.interface?.websiteURL || '',
    lastModified: await latestMtime([manifestPath, path.join(root, 'README.md'), path.join(root, '.mcp.json'), path.join(root, '.app.json')]),
    metadataSource: [manifestPath],
    warnings
  };
}

function dependenciesFromManifest(manifest) {
  const deps = [];
  if (manifest.mcp || manifest.mcpServers) deps.push('MCP 配置');
  if (manifest.apps || manifest.connectors) deps.push('App/Connector');
  if (manifest.hooks) deps.push('Hook');
  for (const keyword of manifest.keywords || []) {
    if (/cli|api|server|browser|node|python/i.test(keyword)) deps.push(keyword);
  }
  return unique(deps);
}

async function mcpNames(file, warnings) {
  if (!(await pathExists(file))) return [];
  const data = await readJson(file, warnings);
  return Object.keys(data?.mcpServers || data?.mcp_servers || {});
}

async function appNames(file, warnings) {
  if (!(await pathExists(file))) return [];
  const data = await readJson(file, warnings);
  return Object.keys(data?.apps || data?.connectors || {});
}

async function hookNames(file, warnings) {
  if (!(await pathExists(file))) return [];
  const data = await readJson(file, warnings);
  if (Array.isArray(data)) return data.map((item) => item.name || item.id).filter(Boolean);
  return Object.keys(data?.hooks || data || {});
}

async function scanPluginMcp(pluginRoot, parentPlugin, context, extensions, warnings) {
  const file = path.join(pluginRoot, '.mcp.json');
  if (!(await pathExists(file))) return;
  const data = await readJson(file, warnings);
  for (const [name, config] of Object.entries(data?.mcpServers || data?.mcp_servers || {})) {
    extensions.push(await buildMcpEntry(name, config, {
      ...context,
      parentPlugin,
      componentType: 'Plugin 内置组件',
      sourcePath: file,
      metadataSource: [file]
    }));
  }
}

async function scanConfiguredMcp(codexConfig, extensions, scanSources, warnings) {
  const file = path.join(os.homedir(), '.codex/config.toml');
  const servers = codexConfig?.mcp_servers || codexConfig?.mcpServers || {};
  if (Object.keys(servers).length) scanSources.push(sourceRecord('全局 MCP 配置', file, true));
  for (const [name, config] of Object.entries(servers)) {
    extensions.push(await buildMcpEntry(name, config, {
      scope: '全局/用户级',
      source: '个人',
      componentType: '独立扩展',
      parentPlugin: '',
      sourcePath: file,
      metadataSource: [file],
      marketplace: '',
      enabled: config?.enabled !== false
    }));
  }
}

async function scanProjectMcp(projectRoot, info, extensions, scanSources, warnings) {
  const file = path.join(projectRoot, '.codex/config.toml');
  if (file === path.join(os.homedir(), '.codex/config.toml')) return;
  if (!(await pathExists(file))) return;
  scanSources.push(sourceRecord('项目 MCP 配置', file, true));
  const data = await readToml(file, warnings);
  for (const [name, config] of Object.entries(data?.mcp_servers || data?.mcpServers || {})) {
    extensions.push(await buildMcpEntry(name, config, {
      scope: '项目级',
      source: '本地项目',
      projectName: info.projectName,
      projectRoot,
      componentType: '独立扩展',
      parentPlugin: '',
      sourcePath: file,
      metadataSource: [file],
      marketplace: '',
      enabled: config?.enabled !== false
    }));
  }
}

async function buildMcpEntry(name, config, context) {
  const safe = redactObject(config || {});
  const descriptionOriginal = sourceText(config?.description, config?.command ? `command: ${config.command}` : '');
  const category = normalizeCategory('', `${name} ${descriptionOriginal}`);
  const basePrompt = promptFor('MCP', name, category, '');
  const dependencies = unique([
    config?.command ? `命令: ${config.command}` : '',
    config?.cwd ? `工作目录: ${config.cwd}` : '',
    config?.env ? `环境变量: ${Object.keys(config.env).join(', ')}` : '',
    safe.args ? '参数已脱敏记录' : ''
  ]);
  return {
    id: stableId(['MCP', context.scope, context.projectRoot || '', context.sourcePath, context.parentPlugin || '', name]),
    name,
    displayName: name,
    invokeName: name,
    invokeSyntax: `MCP「${name}」`,
    type: 'MCP',
    componentType: context.componentType,
    parentPlugin: context.parentPlugin || '',
    scope: context.scope,
    projectName: context.projectName || '',
    projectRoot: context.projectRoot || '',
    sourcePath: context.sourcePath,
    resolvedPath: await realPathSafe(context.sourcePath),
    marketplace: context.marketplace || '',
    source: context.source || '未知',
    version: '',
    author: '',
    enabled: context.enabled !== false,
    status: context.enabled === false ? '禁用' : '正常',
    descriptionOriginal,
    purposeZh: inferPurpose(category, descriptionOriginal || name, name),
    useCases: inferUseCases(category, 'MCP'),
    category,
    basicPrompt: basePrompt,
    examplePrompts: examplePromptsFor('MCP', name, category, basePrompt),
    promptSource: '自动整理',
    dependencies,
    bundledSkills: [],
    bundledMcpServers: [],
    bundledApps: [],
    bundledHooks: [],
    documentationPath: context.sourcePath,
    repository: '',
    homepage: '',
    lastModified: await latestMtime([context.sourcePath]),
    metadataSource: context.metadataSource,
    warnings: []
  };
}

async function scanPluginApps(pluginRoot, parentPlugin, context, extensions, warnings) {
  const file = path.join(pluginRoot, '.app.json');
  if (!(await pathExists(file))) return;
  const data = await readJson(file, warnings);
  for (const [name, config] of Object.entries(data?.apps || data?.connectors || {})) {
    extensions.push(await buildSimpleComponent('App', name, config, file, parentPlugin, context));
  }
}

async function scanPluginHooks(pluginRoot, parentPlugin, context, extensions, warnings) {
  const file = path.join(pluginRoot, 'hooks/hooks.json');
  if (!(await pathExists(file))) return;
  const data = await readJson(file, warnings);
  const hooks = Array.isArray(data) ? Object.fromEntries(data.map((item) => [item.name || item.id, item])) : (data?.hooks || data || {});
  for (const [name, config] of Object.entries(hooks)) {
    if (!name) continue;
    extensions.push(await buildSimpleComponent('Hook', name, config, file, parentPlugin, context));
  }
}

async function buildSimpleComponent(type, name, config, file, parentPlugin, context) {
  const descriptionOriginal = sourceText(config?.description, config?.id || '');
  const category = normalizeCategory('', `${name} ${descriptionOriginal}`);
  const basePrompt = promptFor(type, name, category, '');
  return {
    id: stableId([type, file, parentPlugin, name]),
    name,
    displayName: name,
    invokeName: name,
    invokeSyntax: type === 'App' ? `连接器「${name}」` : `Hook「${name}」`,
    type,
    componentType: 'Plugin 内置组件',
    parentPlugin,
    scope: context.scope,
    projectName: context.projectName || '',
    projectRoot: context.projectRoot || '',
    sourcePath: file,
    resolvedPath: await realPathSafe(file),
    marketplace: context.marketplace || '',
    source: context.source || '未知',
    version: '',
    author: '',
    enabled: context.enabled !== false && config?.enabled !== false,
    status: context.enabled === false || config?.enabled === false ? '禁用' : '正常',
    descriptionOriginal,
    purposeZh: inferPurpose(category, descriptionOriginal || name, name),
    useCases: inferUseCases(category, type),
    category,
    basicPrompt: basePrompt,
    examplePrompts: examplePromptsFor(type, name, category, basePrompt),
    promptSource: '自动整理',
    dependencies: unique([config?.required ? '必需连接器' : '', config?.id ? `ID: ${config.id}` : '']),
    bundledSkills: [],
    bundledMcpServers: [],
    bundledApps: [],
    bundledHooks: [],
    documentationPath: file,
    repository: '',
    homepage: '',
    lastModified: await latestMtime([file]),
    metadataSource: [file],
    warnings: []
  };
}

function finalizeEntry(entry) {
  const warnings = unique(entry.warnings || []);
  let status = entry.status || '正常';
  if (entry.enabled === false) status = '禁用';
  else if (warnings.length && status === '正常') status = '配置异常';
  if (!entry.descriptionOriginal) {
    entry.purposeZh = '功能说明待补充';
    if (!warnings.includes('功能说明待补充')) warnings.push('功能说明待补充');
    if (status === '正常') status = '元数据缺失';
  }
  return {
    ...entry,
    sourcePathCompact: compactHome(entry.sourcePath),
    resolvedPathCompact: compactHome(entry.resolvedPath),
    projectRootCompact: compactHome(entry.projectRoot),
    warnings,
    status
  };
}

function applyPluginUpdate(entry, report) {
  if (!report) return entry;
  const parentKey = entry.parentPlugin && entry.marketplace ? `${entry.parentPlugin}@${entry.marketplace}` : '';
  const ownKey = entry.type === 'Plugin' && entry.marketplace ? `${entry.name}@${entry.marketplace}` : '';
  const record = report.records?.find((item) => item.pluginId === ownKey || item.pluginId === parentKey);
  if (!record) return entry;
  return {
    ...entry,
    updateStatus: record.status,
    updateMessage: record.message,
    updateCheckedAt: record.checkedAt,
    updateUpdatedAt: record.updatedAt,
    updateBeforeVersion: record.beforeVersion,
    updateAfterVersion: record.afterVersion
  };
}

function applyOverride(entry, override) {
  if (!override) return entry;
  const merged = { ...entry };
  for (const key of ['displayName', 'purposeZh', 'category', 'basicPrompt', 'tags', 'notes', 'favorite']) {
    if (override[key] !== undefined) merged[key] = override[key];
  }
  merged.overrideUpdatedAt = override.updatedAt || '';
  return merged;
}

function markDuplicateNames(extensions) {
  const groups = new Map();
  for (const entry of extensions) {
    const key = `${entry.type}:${entry.name}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  for (const group of groups.values()) {
    const distinct = new Set(group.map((entry) => entry.resolvedPath || entry.sourcePath));
    if (distinct.size > 1) {
      for (const entry of group) {
        entry.warnings = unique([...(entry.warnings || []), '同名扩展存在多个安装位置']);
      }
    }
  }
}

function summarize(extensions) {
  const byType = Object.fromEntries(EXTENSION_TYPES.map((type) => [type, extensions.filter((entry) => entry.type === type).length]));
  return {
    total: extensions.length,
    byType,
    project: extensions.filter((entry) => entry.scope === '项目级').length,
    global: extensions.filter((entry) => entry.scope === '全局/用户级').length,
    disabled: extensions.filter((entry) => entry.enabled === false).length,
    abnormal: extensions.filter((entry) => !['正常', '禁用'].includes(entry.status)).length
  };
}

function sourceRecord(label, sourcePath, exists) {
  return {
    label,
    path: sourcePath,
    pathCompact: compactHome(sourcePath),
    exists
  };
}
