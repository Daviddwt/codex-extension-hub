import { loadCatalog } from './scanner/index.mjs';

const INTENT_RULES = [
  { name: 'PPT / 方案材料', terms: ['ppt', 'powerpoint', 'slide', 'slides', 'deck', 'presentation', '演示', '幻灯', '汇报', '方案', '售前', '标书'], boosts: ['ppt', 'presentation', 'slide', 'deck', '方案', '演示文稿', '幻灯片'] },
  { name: '前端 / 网页应用', terms: ['web', 'frontend', 'react', 'next', 'vite', '页面', '网页', '前端', '网站', '应用', '界面', 'dashboard', '看板'], boosts: ['build-web-app', 'frontend', 'react', 'next', 'vite', '网页应用', '前端'] },
  { name: '浏览器自动化', terms: ['browser', 'chrome', '网页操作', '打开网页', '点击', '填写', '截图', '浏览器'], boosts: ['browser', 'chrome', 'playwright', 'computer', '截图', '浏览器'] },
  { name: 'GitHub / 代码协作', terms: ['github', 'git', 'pr', 'issue', '仓库', '代码审查', 'ci', 'pull request'], boosts: ['github', 'git', 'pr', 'issue', '仓库', 'ci'] },
  { name: '部署 / 云服务', terms: ['deploy', 'vercel', '部署', '发布', '上线', '服务器', 'ci/cd', '环境变量'], boosts: ['deploy', 'vercel', '部署', '发布', '服务器', 'env'] },
  { name: '文档 / PDF', terms: ['doc', 'docs', 'word', 'pdf', '文档', '合同', '报告', '资料', '阅读', '解析'], boosts: ['document', 'docx', 'word', 'pdf', '文档', '资料'] },
  { name: '表格 / 数据', terms: ['excel', 'xlsx', 'csv', 'spreadsheet', '表格', '数据', '统计', '分析', '报表'], boosts: ['spreadsheet', 'excel', 'csv', '表格', '数据'] },
  { name: '无障碍 / 体验审查', terms: ['accessibility', 'a11y', 'aria', 'wcag', '无障碍', '可访问性', '键盘', '对比度', 'ux', '体验'], boosts: ['accessibility', 'aria', 'wcag', '无障碍', '可访问性', '键盘', '对比度'] },
  { name: '邮件 / 日程 / Google', terms: ['gmail', 'calendar', 'google', '邮件', '日程', '会议', '日历'], boosts: ['gmail', 'calendar', 'google', '邮件', '日程'] },
  { name: '投资 / 财务', terms: ['stock', '股票', '投资', '财务', '持仓', '估值', '龙虎榜', '交易'], boosts: ['stock', 'finance', '投资', '财务', '股票'] },
  { name: '图文内容 / 社媒发布', terms: ['微信公众号', '公众号', '小红书', 'x', 'twitter', '论坛', '发文', '发布', '文章', '图文', '封面', '配图', '标题', '文案'], boosts: ['设计', '图文', '图片', '封面', '配图', '海报', '文案', 'presentation', 'image', 'design'] },
  { name: '图像 / 视频', terms: ['image', 'video', '图片', '图像', '视频', '海报', '封面', '配图', '生成图', '动效'], boosts: ['image', 'video', '图片', '图像', '视频', '海报', '封面'] }
];

const STOP_WORDS = new Set(['我要', '需要', '帮我', '一个', '这个', '那个', '使用', '哪些', '插件', 'skill', 'skills', 'plugin', 'plugins', '做', '搞', '生成']);

export async function recommendExtensions(cwd, task) {
  const catalog = await loadCatalog(cwd);
  return rankExtensions(task, catalog.extensions || []);
}

export function rankExtensions(task, extensions) {
  const normalizedTask = normalize(task);
  if (!normalizedTask) {
    throw new Error('请输入要完成的事情。');
  }

  const taskTokens = tokenize(normalizedTask);
  const matchedRules = INTENT_RULES.filter((rule) => rule.terms.some((term) => normalizedTask.includes(normalize(term))));
  const ranked = dedupeRanked(extensions
    .map((item) => scoreItem(item, normalizedTask, taskTokens, matchedRules))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || typeWeight(b.item.type) - typeWeight(a.item.type)))
    .slice(0, 12);

  const recommendedIds = ranked.map((entry) => entry.item.id);
  return {
    generatedAt: new Date().toISOString(),
    mode: 'local-intent-ranking',
    task,
    capabilityNote: '当前为本地智能推荐：只基于已扫描扩展元数据、用途说明、分类和提示词打分；未接入外部大模型，不执行任何扩展脚本。',
    matchedIntents: matchedRules.map((rule) => rule.name),
    recommendedIds,
    summary: summaryFor(ranked, matchedRules),
    results: ranked.map(({ item, score, reasons }) => ({
      id: item.id,
      name: item.name,
      displayName: item.displayName,
      invokeSyntax: item.invokeSyntax,
      type: item.type,
      parentPlugin: item.parentPlugin,
      category: item.category,
      score,
      confidence: confidence(score),
      reasons,
      usageHint: usageHint(item)
    }))
  };
}

function scoreItem(item, normalizedTask, taskTokens, matchedRules) {
  const searchable = normalize([
    item.name,
    item.displayName,
    item.invokeName,
    item.type,
    item.category,
    item.parentPlugin,
    item.marketplace,
    item.purposeZh,
    item.descriptionOriginal,
    item.useCases?.join(' '),
    item.basicPrompt,
    item.examplePrompts?.join(' '),
    item.tags?.join(' '),
    item.notes
  ].filter(Boolean).join(' '));
  const reasons = [];
  let score = 0;

  for (const token of taskTokens) {
    if (token.length < 2) continue;
    if (searchable.includes(token)) {
      score += token.length > 3 ? 4 : 2;
      if (reasons.length < 3) reasons.push(`匹配任务关键词「${token}」`);
    }
  }

  for (const rule of matchedRules) {
    const hits = rule.boosts.filter((term) => searchable.includes(normalize(term)));
    if (hits.length) {
      score += 8 + Math.min(hits.length, 3) * 3;
      reasons.push(`匹配意图「${rule.name}」`);
    }
  }

  const profileBoost = taskProfileBoost(item, searchable, normalizedTask);
  if (profileBoost.score) {
    score += profileBoost.score;
    reasons.push(profileBoost.reason);
  }
  const primaryBoost = primaryPluginBoost(item, normalizedTask);
  if (primaryBoost.score) {
    score += primaryBoost.score;
    reasons.unshift(primaryBoost.reason);
  }

  if (item.type === 'Plugin') score += 14;
  if (isFrontendBuildTask(normalizedTask) && /(computer-use|browser|chrome|playwright)/.test(normalize(`${item.name} ${item.displayName}`)) && !isBrowserOperationTask(normalizedTask)) {
    score -= 18;
  }
  if (item.type === 'Skill') score += item.parentPlugin ? 0 : -6;
  if (item.type === 'MCP') score += 1;
  if (item.enabled === false) score -= 10;
  if (item.status && !['正常', '禁用'].includes(item.status)) score -= 2;
  if (/官方|个人|本地项目/.test(item.source || '')) score += 1;
  if (normalizedTask.includes(normalize(item.name)) || normalizedTask.includes(normalize(item.displayName))) {
    score += 20;
    reasons.unshift('直接命中扩展名称');
  }

  return {
    item,
    score,
    reasons: [...new Set(reasons)].slice(0, 4)
  };
}

function dedupeRanked(entries) {
  const best = new Map();
  for (const entry of entries) {
    const key = [
      entry.item.type,
      entry.item.invokeName || entry.item.name,
      entry.item.parentPlugin || '',
      entry.item.marketplace || ''
    ].join(':');
    const current = best.get(key);
    if (!current || entry.score > current.score) best.set(key, entry);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || typeWeight(b.item.type) - typeWeight(a.item.type));
}

function primaryPluginBoost(item, normalizedTask) {
  if (item.type !== 'Plugin') return { score: 0, reason: '' };
  const name = normalize(`${item.name} ${item.displayName}`);
  if (isFrontendBuildTask(normalizedTask)) {
    if (/build-web-apps/.test(name)) return { score: 26, reason: '主插件适合构建网页应用' };
    if (/(vercel|openai-developers)/.test(name)) return { score: 12, reason: '主插件适合开发 / 部署链路' };
  }
  if (/(ppt|幻灯|演示|方案|汇报)/.test(normalizedTask)) {
    if (/(presentations|ppt|solution-factory|baoyu-design|google-drive)/.test(name)) return { score: 20, reason: '主插件适合演示文稿任务' };
  }
  if (isContentPublishingTask(normalizedTask)) {
    if (/(baoyu-design|cowart|product-design)/.test(name)) return { score: 28, reason: '主插件适合图文内容设计' };
    if (/(google-drive|documents|presentations)/.test(name)) return { score: 12, reason: '主插件适合整理发布素材' };
  }
  if (/(excel|xlsx|csv|表格|数据|报表)/.test(normalizedTask)) {
    if (/(spreadsheets|visual-analytics|google-drive)/.test(name)) return { score: 20, reason: '主插件适合表格 / 数据任务' };
  }
  return { score: 0, reason: '' };
}

function taskProfileBoost(item, searchable, normalizedTask) {
  const name = normalize(`${item.name} ${item.displayName} ${item.invokeName}`);
  if (isFrontendBuildTask(normalizedTask)) {
    if (/(build-web-app|frontend|react|next|vite|web-design|ux-audit)/.test(name) || /(前端|react|vite|next\.js|web app)/.test(searchable)) {
      return { score: 14, reason: '适合网页 / 前端任务' };
    }
  }
  if (/(可访问性|无障碍|aria|wcag|键盘|对比度|移动端|体验)/.test(normalizedTask)) {
    if (/(accessibility|aria|contrast|keyboard|ux|web-design)/.test(name) || /(可访问性|无障碍|aria|wcag|键盘|对比度)/.test(searchable)) {
      return { score: 12, reason: '适合体验 / 可访问性检查' };
    }
  }
  if (isContentPublishingTask(normalizedTask)) {
    if (/(design|image|cowart|baoyu|presentation|documents|humanize|writing|ux-writing)/.test(name) || /(图文|图片|封面|配图|海报|文案|写作|设计)/.test(searchable)) {
      return { score: 14, reason: '适合图文内容创作' };
    }
  }
  return { score: 0, reason: '' };
}

function isFrontendBuildTask(normalizedTask) {
  return /(网页|前端|网站|页面|react|next|vite|web|frontend|应用)/.test(normalizedTask);
}

function isBrowserOperationTask(normalizedTask) {
  return /(浏览器|点击|截图|填写|网页操作|自动化|chrome|browser|playwright|打开网页)/.test(normalizedTask);
}

function isContentPublishingTask(normalizedTask) {
  return /(公众号|小红书|twitter|论坛|发文|发布|文章|图文|封面|配图|标题|文案|海报)/.test(normalizedTask);
}

function tokenize(value) {
  const ascii = value.match(/[a-z0-9][a-z0-9._-]*/g) || [];
  const cjk = value
    .replace(/[a-z0-9._-]+/g, ' ')
    .split(/[，。、“”‘’；：？！\s/\\|+()（）[\]{}<>《》-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && !STOP_WORDS.has(part));
  return [...new Set([...ascii, ...cjk])];
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function typeWeight(type) {
  return { Plugin: 5, Skill: 4, MCP: 3, App: 2, Hook: 1 }[type] || 0;
}

function confidence(score) {
  if (score >= 30) return '高';
  if (score >= 16) return '中';
  return '低';
}

function usageHint(item) {
  if (item.type === 'Plugin') return `优先尝试 ${item.invokeSyntax}`;
  if (item.parentPlugin) return `可作为 ${item.parentPlugin} 的配套能力：${item.invokeSyntax}`;
  return `可直接调用 ${item.invokeSyntax}`;
}

function summaryFor(ranked, matchedRules) {
  if (!ranked.length) return '没有找到足够相关的扩展。可以换一种说法，或先重新扫描扩展目录。';
  const top = ranked[0].item;
  const intent = matchedRules.length ? `，识别到 ${matchedRules.map((rule) => rule.name).join('、')} 方向` : '';
  return `建议优先看 ${top.displayName || top.name}${intent}。`;
}
