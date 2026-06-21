import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { scanCatalog } from '../server/scanner/index.mjs';
import { redactObject, redactText } from '../server/scanner/safety.mjs';
import { classifyPluginForUpdate } from '../server/plugin-updater.mjs';
import { isRelevantSelfBuiltChange } from '../server/self-built-watcher.mjs';
import { rankExtensions } from '../server/recommender.mjs';

test('redacts sensitive keys and token-shaped values', () => {
  const input = {
    api_key: 'sk-this-should-not-appear-anywhere',
    nested: {
      Authorization: 'Bearer very-secret-token-value',
      safe: 'visible'
    }
  };
  const redacted = redactObject(input);
  assert.equal(redacted.api_key, '[REDACTED]');
  assert.equal(redacted.nested.Authorization, '[REDACTED]');
  assert.equal(redacted.nested.safe, 'visible');
  assert.equal(redactText('token sk-abcdef1234567890'), 'token [REDACTED]');
});

test('scans a project skill without executing scripts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'extension-hub-'));
  const skillDir = path.join(root, '.agents/skills/sample-skill');
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(root, 'catalog.config.json'), JSON.stringify({ projectRoots: [root], maxDepth: 1, includeAdminSkills: false, includePluginCache: false }, null, 2));
  await writeFile(path.join(root, 'catalog.overrides.json'), '{}');
  await writeFile(path.join(skillDir, 'SKILL.md'), [
    '---',
    'name: sample-skill',
    'description: Use when testing browser screenshots and frontend quality.',
    '---',
    '',
    '# Sample Skill'
  ].join('\n'));

  const result = await scanCatalog(root);
  const skill = result.extensions.find((item) => item.name === 'sample-skill');
  assert.ok(skill);
  assert.equal(skill.type, 'Skill');
  assert.equal(skill.scope, '项目级');
  assert.match(skill.basicPrompt, /^\$sample-skill/);
  assert.match(skill.purposeZh, /用于/);
});

test('keeps manual overrides after rescan', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'extension-hub-override-'));
  const skillDir = path.join(root, '.agents/skills/override-skill');
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(root, 'catalog.config.json'), JSON.stringify({ projectRoots: [root], maxDepth: 1, includeAdminSkills: false, includePluginCache: false }, null, 2));
  await writeFile(path.join(skillDir, 'SKILL.md'), '---\nname: override-skill\ndescription: Build frontend apps.\n---\n');
  const first = await scanCatalog(root);
  const id = first.extensions.find((item) => item.name === 'override-skill').id;
  await writeFile(path.join(root, 'catalog.overrides.json'), JSON.stringify({ [id]: { purposeZh: '人工覆盖说明', favorite: true } }, null, 2));
  const second = await scanCatalog(root);
  const item = second.extensions.find((entry) => entry.id === id);
  assert.equal(item.purposeZh, '人工覆盖说明');
  assert.equal(item.favorite, true);
});

test('classifies third-party plugin update policy without updating self-built plugins', () => {
  assert.equal(classifyPluginForUpdate({ marketplaceName: 'local-plugins' }).status, 'skipped-self-built');
  assert.equal(classifyPluginForUpdate({ marketplaceName: 'openai-bundled' }).status, 'skipped-managed');
  assert.equal(classifyPluginForUpdate({ marketplaceName: 'openai-primary-runtime' }).status, 'skipped-managed');
  const github = classifyPluginForUpdate({ marketplaceName: 'openai-curated', name: 'github' });
  assert.equal(github.shouldUpdate, true);
  assert.equal(github.status, 'pending');
});

test('filters self-built watcher events to extension metadata only', () => {
  assert.equal(isRelevantSelfBuiltChange('sample-skill/SKILL.md'), true);
  assert.equal(isRelevantSelfBuiltChange('agents/openai.yaml'), true);
  assert.equal(isRelevantSelfBuiltChange('marketplace.json'), true);
  assert.equal(isRelevantSelfBuiltChange('.codex/config.toml'), true);
  assert.equal(isRelevantSelfBuiltChange('node_modules/pkg/plugin.json'), false);
  assert.equal(isRelevantSelfBuiltChange('.DS_Store'), false);
  assert.equal(isRelevantSelfBuiltChange('assets/example.png'), false);
});

test('recommends extensions by task intent without executing extensions', () => {
  const response = rankExtensions('我要做一个网页应用并检查可访问性', [
    {
      id: 'web',
      name: 'build-web-apps',
      displayName: 'Build Web Apps',
      invokeName: 'build-web-apps',
      invokeSyntax: '@build-web-apps',
      type: 'Plugin',
      category: '前端开发',
      purposeZh: '用于构建、调试或优化网页与前端界面，适合开发 React、Next.js、Vite。',
      descriptionOriginal: 'frontend React Vite web apps',
      useCases: ['网页应用'],
      basicPrompt: '@build-web-apps',
      examplePrompts: [],
      parentPlugin: '',
      marketplace: 'openai-curated',
      source: '官方',
      enabled: true,
      status: '正常'
    },
    {
      id: 'a11y',
      name: 'aria-specialist',
      displayName: 'ARIA Specialist',
      invokeName: 'aria-specialist',
      invokeSyntax: '$aria-specialist',
      type: 'Skill',
      category: '可访问性',
      purposeZh: '用于检查和改进网页可访问性、ARIA、键盘操作和 WCAG。',
      descriptionOriginal: 'accessibility ARIA WCAG',
      useCases: ['可访问性检查'],
      basicPrompt: '$aria-specialist',
      examplePrompts: [],
      parentPlugin: '',
      marketplace: '',
      source: '个人',
      enabled: true,
      status: '正常'
    }
  ]);
  assert.equal(response.results[0].id, 'web');
  assert.ok(response.recommendedIds.includes('a11y'));
  assert.match(response.capabilityNote, /本地智能推荐/);
});

test('recommends design plugins for social content publishing tasks', () => {
  const response = rankExtensions('我要做公众号和小红书通用的 AI 使用技巧图文，需要封面和配图', [
    {
      id: 'design',
      name: 'baoyu-design',
      displayName: 'Baoyu Design',
      invokeName: 'baoyu-design',
      invokeSyntax: '@baoyu-design',
      type: 'Plugin',
      category: '图片与设计',
      purposeZh: '用于创建图文、海报、封面和设计页面。',
      descriptionOriginal: 'design image cover social content',
      useCases: ['图文内容'],
      basicPrompt: '@baoyu-design',
      examplePrompts: [],
      parentPlugin: '',
      marketplace: 'local-plugins',
      source: '个人',
      enabled: true,
      status: '正常'
    },
    {
      id: 'git',
      name: 'github',
      displayName: 'GitHub',
      invokeName: 'github',
      invokeSyntax: '@github',
      type: 'Plugin',
      category: '编程开发',
      purposeZh: '用于处理代码仓库。',
      descriptionOriginal: 'repository pull request issue',
      useCases: ['代码协作'],
      basicPrompt: '@github',
      examplePrompts: [],
      parentPlugin: '',
      marketplace: 'openai-curated',
      source: '官方',
      enabled: true,
      status: '正常'
    }
  ]);
  assert.equal(response.results[0].id, 'design');
  assert.ok(response.matchedIntents.includes('图文内容 / 社媒发布'));
});
