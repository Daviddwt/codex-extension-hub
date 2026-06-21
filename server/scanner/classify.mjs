const CATEGORY_RULES = [
  ['Git 与 GitHub', /github|git\b|pull request|pr\b|issue|commit/i],
  ['浏览器自动化', /browser|chrome|playwright|screenshot|网页|浏览器|截图|click|navigate/i],
  ['网页与前端', /frontend|react|next|vite|tailwind|shadcn|web app|ui|ux|前端|网页/i],
  ['文档与教程', /docs?|tutorial|guide|documentation|教程|文档/i],
  ['PDF 与文件处理', /pdf|file|docx|word|document|文件/i],
  ['表格与数据', /spreadsheet|excel|sheet|csv|data|postgres|supabase|表格|数据/i],
  ['搜索与研究', /search|research|zotero|notebook|browser|检索|研究/i],
  ['图片与设计', /image|design|figma|visual|ppt|presentation|slide|图片|设计|海报/i],
  ['测试与质量', /test|qa|lint|verify|accessibility|a11y|review|测试|质量|审查/i],
  ['部署与运维', /deploy|vercel|ci|runtime|server|ops|部署|运维/i],
  ['安全', /security|secret|auth|permission|安全|权限/i],
  ['沟通与协作', /gmail|calendar|slack|wechat|meeting|email|协作|日程|邮件/i],
  ['项目管理', /project|task|workflow|plan|项目|任务/i],
  ['办公效率', /productivity|office|daily|效率|办公/i],
  ['编程开发', /code|developer|sdk|api|mcp|cli|agent|编程|开发/i]
];

const PURPOSES = {
  'Git 与 GitHub': '用于处理 GitHub、代码协作和仓库工作流，适合在需要查看 PR、Issue、提交或项目协作时使用。',
  '浏览器自动化': '用于让 Codex 操作浏览器、检查网页或采集页面信息，适合在需要打开页面、点击、填写表单或截图时使用。',
  '网页与前端': '用于构建、调试或优化网页与前端界面，适合在开发 React、Next.js、Vite 或交互式页面时使用。',
  '文档与教程': '用于阅读、生成或整理文档与教程，适合在需要解释 API、编写指南或沉淀知识时使用。',
  'PDF 与文件处理': '用于处理 PDF、Word、文件解析或本地文档，适合在需要读取、转换、检查文件内容时使用。',
  '表格与数据': '用于处理表格、数据集和结构化信息，适合在需要分析 Excel、CSV、数据库或指标时使用。',
  '搜索与研究': '用于检索资料、整理研究线索或引用来源，适合在需要查找证据、论文、网页或知识库内容时使用。',
  '图片与设计': '用于生成、分析或重建视觉素材，适合在需要图片、设计稿、PPT、视觉方案或素材处理时使用。',
  '测试与质量': '用于验证功能、审查质量和发现问题，适合在需要跑测试、做可访问性检查或代码审查时使用。',
  '部署与运维': '用于部署、运行时配置和服务排障，适合在需要发布项目、检查 CI/CD、服务器或云服务状态时使用。',
  '安全': '用于检查安全、权限和敏感信息边界，适合在需要审计配置、密钥、访问控制或风险时使用。',
  '沟通与协作': '用于处理邮件、日程、会议和团队协作信息，适合在需要整理沟通上下文或安排协作事项时使用。',
  '项目管理': '用于规划、拆解和跟踪项目工作，适合在需要形成任务清单、路线图或执行节奏时使用。',
  '办公效率': '用于提升日常办公和个人工作流效率，适合在需要整理、汇总、自动化常规事务时使用。',
  '编程开发': '用于辅助编码、调试和开发工具链工作，适合在需要生成代码、理解工程或调用开发工具时使用。',
  '其他': '功能说明待补充'
};

export function normalizeCategory(category, text = '') {
  const raw = String(category || '').trim();
  const direct = {
    'Developer Tools': '编程开发',
    Productivity: '办公效率',
    Design: '图片与设计',
    'Data Visualization': '表格与数据'
  }[raw];
  if (direct) return direct;
  for (const [label, rule] of CATEGORY_RULES) {
    if (rule.test(`${raw} ${text}`)) return label;
  }
  return '其他';
}

export function inferPurpose(category, description, name) {
  const text = `${description || ''} ${name || ''}`.trim();
  if (!text || text.length < 8) return '功能说明待补充';
  const lower = text.toLowerCase();
  if (/screenshot|截图/.test(lower)) return '用于围绕网页或界面截图完成检查、采集和验证，适合在需要保留可视化步骤证据时使用。';
  if (/ppt|presentation|slide|deck|幻灯片/.test(lower)) return '用于处理演示文稿、幻灯片或方案视觉材料，适合在需要生成、检查或转换 PPT 内容时使用。';
  if (/accessibility|aria|keyboard|contrast|wcag|可访问/.test(lower)) return '用于检查和改进网页可访问性，适合在需要验证键盘操作、ARIA、对比度或 WCAG 要求时使用。';
  return PURPOSES[category] || PURPOSES['其他'];
}

export function inferUseCases(category, type) {
  const common = {
    Skill: ['用自然语言调用专项工作流', '让 Codex 按该技能的规则执行任务'],
    Plugin: ['查看该插件包含哪些能力', '确认插件启用状态和内置组件'],
    MCP: ['确认 MCP Server 的命令和来源', '判断当前 Codex 是否配置了对应工具服务'],
    App: ['确认插件连接的 App 或 Connector', '了解该连接器所属插件和启用边界'],
    Hook: ['确认插件声明的 Hook', '排查自动触发能力的来源']
  }[type] || ['查看扩展用途', '确认安装位置和调用方式'];
  const byCategory = {
    '浏览器自动化': '需要自动操作网页、检查页面或保存截图',
    '网页与前端': '需要构建、调试或验证前端界面',
    '图片与设计': '需要生成、整理或验证视觉素材',
    '测试与质量': '需要检查质量、运行验证或审查风险',
    'Git 与 GitHub': '需要处理仓库、PR、Issue 或提交记录'
  }[category];
  return byCategory ? [byCategory, ...common].slice(0, 5) : common;
}

export function promptFor(type, invokeName, category, suppliedPrompt) {
  if (suppliedPrompt) return suppliedPrompt;
  if (type === 'Plugin') return `@${invokeName} 帮我完成一个相关任务，并说明你会调用哪些能力。`;
  if (type === 'MCP') return `使用 MCP「${invokeName}」帮我检查当前可用工具，并完成一个最小验证。`;
  if (type === 'App') return `使用连接器「${invokeName}」帮我读取相关信息，并说明数据来源。`;
  if (type === 'Hook') return `检查 Hook「${invokeName}」的触发条件和作用边界。`;
  const task = category === '网页与前端' ? '实现并验证这个前端功能' : '帮我完成这个任务';
  return `$${invokeName} ${task}`;
}

export function examplePromptsFor(type, invokeName, category, basePrompt) {
  const examples = [basePrompt];
  if (type === 'Skill') {
    examples.push(`$${invokeName} 先确认输入、输出和成功标准，再开始执行。`);
    examples.push(`$${invokeName} 基于当前仓库完成任务，并在最后说明验证结果。`);
  } else if (type === 'Plugin') {
    examples.push(`@${invokeName} 列出这个插件可用的 Skill、MCP 或 App，并说明使用场景。`);
    examples.push(`@${invokeName} 按真实能力边界完成任务，不要使用未确认的替代路径。`);
  } else if (type === 'MCP') {
    examples.push(`使用 MCP「${invokeName}」列出可调用能力，并做只读验证。`);
    examples.push(`使用 MCP「${invokeName}」完成任务前先说明数据来源和权限边界。`);
  } else {
    examples.push(`查看「${invokeName}」的来源、父插件和启用状态。`);
    examples.push(`说明「${invokeName}」能做什么，以及什么时候不应该使用。`);
  }
  return examples.slice(0, 3);
}
