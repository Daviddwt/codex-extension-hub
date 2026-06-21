import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  FolderOpen,
  Grid2X2,
  Info,
  Layers3,
  ListFilter,
  Moon,
  PackageCheck,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Sun,
  Table2,
  X
} from 'lucide-react';
import { getCatalog, getWatchStatus, openPath, patchOverride, recommendExtensions, rescanCatalog, runPluginUpdate } from './api';
import type { CatalogResponse, ExtensionItem, ExtensionType, HubEvent, RecommendationResponse, RecommendationResult, ViewMode, WatchStatus } from './types';
import { copyText, formatTime, groupBy, matchSearch, TYPES, uniqueValues } from './utils';
import './styles.css';

declare global {
  interface Window {
    __codexExtensionHubRoot?: Root;
  }
}

const initialFilters = {
  type: '',
  category: '',
  scope: '',
  project: '',
  enabled: '',
  marketplace: '',
  component: '',
  abnormal: '',
  favorite: ''
};

type SummaryMetricKey = 'all' | 'Plugin' | 'Skill' | 'MCP' | 'project' | 'global' | 'disabled' | 'abnormal';

const PAGE_SIZE_OPTIONS = [50, 100, 200] as const;

function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [updatingPlugins, setUpdatingPlugins] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(initialFilters);
  const [view, setView] = useState<ViewMode>('cards');
  const [selected, setSelected] = useState<ExtensionItem | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('hub-theme') as 'light' | 'dark') || 'light');
  const [toast, setToast] = useState('');
  const [watchStatus, setWatchStatus] = useState<WatchStatus | null>(null);
  const [taskInput, setTaskInput] = useState('');
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [recommendationOnly, setRecommendationOnly] = useState(false);
  const [recommendationError, setRecommendationError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(100);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const detailReturnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('hub-theme', theme);
  }, [theme]);

  useEffect(() => {
    getCatalog()
      .then(setCatalog)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    getWatchStatus().then(setWatchStatus).catch(() => {
      setWatchStatus({
        enabled: false,
        status: 'disabled',
        watched: [],
        note: '自建扩展自动同步状态暂不可读取。'
      });
    });

    const events = new EventSource('/api/events');
    const handleStatus = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as HubEvent;
      if (event.status) setWatchStatus(event.status);
    };
    const handleCatalogUpdated = async (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as HubEvent;
      const next = await getCatalog();
      setCatalog(next);
      setToast(`自建扩展已自动同步：${next.summary.total} 个扩展`);
      setSelected((current) => current ? next.extensions.find((item) => item.id === current.id) || null : null);
      if (event.generatedAt) {
        setWatchStatus((current) => current ? { ...current, lastScanAt: event.generatedAt, status: 'watching' } : current);
      }
    };
    const handleFailed = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as HubEvent;
      setError(event.error || '自建扩展自动同步失败');
    };
    events.addEventListener('watch-status', handleStatus);
    events.addEventListener('catalog-updated', handleCatalogUpdated);
    events.addEventListener('catalog-update-failed', handleFailed);
    events.onerror = () => {
      setWatchStatus((current) => current ? { ...current, status: 'disabled', note: '自动同步连接已断开，可使用重新扫描。' } : current);
    };
    return () => {
      events.removeEventListener('watch-status', handleStatus);
      events.removeEventListener('catalog-updated', handleCatalogUpdated);
      events.removeEventListener('catalog-update-failed', handleFailed);
      events.close();
    };
  }, []);

  const items = catalog?.extensions || [];
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const recommendationIds = useMemo(() => new Set(recommendation?.recommendedIds || []), [recommendation]);
  const activeFilterEntries = useMemo(() => {
    const labels: Record<keyof typeof initialFilters, string> = {
      type: '扩展类型',
      category: '功能分类',
      scope: '安装范围',
      project: '所属项目',
      enabled: '启用状态',
      marketplace: 'Marketplace',
      component: '组件关系',
      abnormal: '异常状态',
      favorite: '收藏'
    };
    return (Object.entries(filters) as Array<[keyof typeof filters, string]>)
      .filter(([, value]) => value)
      .map(([key, value]) => `${labels[key]}：${filterValueLabel(key, value)}`);
  }, [filters]);
  const activeFilterCount = activeFilterEntries.length + (query.trim() ? 1 : 0) + (recommendationOnly ? 1 : 0);
  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (recommendationOnly && !recommendationIds.has(item.id)) return false;
      if (!matchSearch(item, query)) return false;
      if (filters.type && item.type !== filters.type) return false;
      if (filters.category && item.category !== filters.category) return false;
      if (filters.scope && item.scope !== filters.scope) return false;
      if (filters.project && item.projectName !== filters.project) return false;
      if (filters.marketplace && item.marketplace !== filters.marketplace) return false;
      if (filters.component && item.componentType !== filters.component) return false;
      if (filters.enabled === 'enabled' && !item.enabled) return false;
      if (filters.enabled === 'disabled' && item.enabled) return false;
      if (filters.abnormal === 'yes' && ['正常', '禁用'].includes(item.status)) return false;
      if (filters.favorite === 'yes' && !item.favorite) return false;
      return true;
    });
  }, [items, query, filters, recommendationOnly, recommendationIds]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [query, filters, recommendationOnly, pageSize, view]);

  async function handleRescan() {
    setScanning(true);
    setError('');
    try {
      const next = await rescanCatalog();
      setCatalog(next);
      setToast(`重新扫描完成：${next.summary.total} 个扩展`);
      if (selected) setSelected(next.extensions.find((item) => item.id === selected.id) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  async function handlePluginUpdate() {
    setUpdatingPlugins(true);
    setError('');
    try {
      await runPluginUpdate(false);
      const next = await getCatalog();
      setCatalog(next);
      setToast('第三方插件检查更新完成');
      if (selected) setSelected(next.extensions.find((item) => item.id === selected.id) || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdatingPlugins(false);
    }
  }

  async function handleRecommend() {
    const explicitLookup = parseExplicitExtensionLookup(taskInput);
    if (!taskInput.trim()) {
      setToast('先输入要完成的事情');
      return;
    }
    setRecommending(true);
    setRecommendationError('');
    try {
      const next = await recommendExtensions(taskInput);
      setRecommendation(next);
      setRecommendationOnly(false);
      if (explicitLookup.query) {
        setQuery(explicitLookup.query);
        setFilters({
          ...initialFilters,
          type: explicitLookup.type || ''
        });
        setView('cards');
        setToast(`已推荐 ${next.results.length} 个扩展，并在下方列表搜索 ${explicitLookup.query}`);
      } else {
        setToast(`已推荐 ${next.results.length} 个扩展`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRecommendationError(message === 'Not Found' ? '推荐接口未加载。请重启扩展中心本地服务后再试。' : message);
    } finally {
      setRecommending(false);
    }
  }

  async function handleFavorite(item: ExtensionItem) {
    const next = await patchOverride(item.id, { favorite: !item.favorite });
    setCatalog(next);
    setSelected(next.extensions.find((entry) => entry.id === item.id) || null);
  }

  function setFilter(key: keyof typeof filters, value: string) {
    if (recommendationOnly) setRecommendationOnly(false);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleQueryChange(value: string) {
    if (recommendationOnly) setRecommendationOnly(false);
    setQuery(value);
  }

  function clearAllConditions() {
    setFilters(initialFilters);
    setQuery('');
    setRecommendationOnly(false);
    setPage(1);
  }

  function handleSummarySelect(key: SummaryMetricKey) {
    setRecommendationOnly(false);
    setQuery('');
    setView('cards');
    setPage(1);
    if (key === 'all') {
      setFilters(initialFilters);
      return;
    }
    if (key === 'Plugin' || key === 'Skill' || key === 'MCP') {
      setFilters({ ...initialFilters, type: key });
      return;
    }
    if (key === 'project') {
      setFilters({ ...initialFilters, scope: '项目级' });
      return;
    }
    if (key === 'global') {
      setFilters({ ...initialFilters, scope: '全局/用户级' });
      return;
    }
    if (key === 'disabled') {
      setFilters({ ...initialFilters, enabled: 'disabled' });
      return;
    }
    if (key === 'abnormal') {
      setFilters({ ...initialFilters, abnormal: 'yes' });
      setToast('异常表示扫描到配置警告；当前主要原因是同名扩展存在多个安装位置。');
    }
  }

  function openDetail(item: ExtensionItem) {
    const active = document.activeElement;
    detailReturnRef.current = active instanceof HTMLElement ? active : null;
    setSelected(item);
  }

  function closeDetail() {
    setSelected(null);
    window.requestAnimationFrame(() => detailReturnRef.current?.focus());
  }

  const categories = uniqueValues(items, (item) => item.category);
  const scopes = uniqueValues(items, (item) => item.scope);
  const projects = uniqueValues(items, (item) => item.projectName);
  const marketplaces = uniqueValues(items, (item) => item.marketplace);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">跳到主要内容</a>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">CE</div>
          <div>
            <strong>Codex 扩展中心</strong>
            <span>Extension Hub</span>
          </div>
        </div>
        <button
          className="filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="extension-filters"
          onClick={() => setFiltersOpen((current) => !current)}
        >
          <ListFilter size={16} />
          筛选{activeFilterCount ? `（${activeFilterCount}）` : ''}
        </button>

        <FilterPanel
          id="extension-filters"
          filters={filters}
          categories={categories}
          scopes={scopes}
          projects={projects}
          marketplaces={marketplaces}
          onChange={setFilter}
          onReset={clearAllConditions}
          collapsed={!filtersOpen}
        />
      </aside>

      <main id="main" className="main" tabIndex={-1}>
        <header className="topbar">
          <div>
            <span className="eyebrow">Local Extension Workspace</span>
            <h1>Codex 扩展中心</h1>
            <p>{catalog ? `从本机配置、缓存和 Skill 目录汇总扩展。最后扫描：${formatTime(catalog.generatedAt)}` : '正在读取本地扫描结果'}</p>
          </div>
          <div className="top-actions">
            <button className="icon-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="切换明暗模式">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="primary-button" type="button" onClick={handleRescan} disabled={scanning}>
              <RefreshCw size={17} className={scanning ? 'spinning' : ''} />
              {scanning ? '扫描中' : '重新扫描'}
            </button>
            <button className="secondary-button" type="button" onClick={handlePluginUpdate} disabled={updatingPlugins}>
              <PackageCheck size={17} className={updatingPlugins ? 'spinning' : ''} />
              {updatingPlugins ? '更新中' : '检查更新'}
            </button>
          </div>
        </header>

        {catalog && <Summary summary={catalog.summary} activeKey={activeSummaryKey(filters, query, recommendationOnly)} onSelect={handleSummarySelect} />}
        {catalog?.pluginUpdateReport && <UpdateSummary report={catalog.pluginUpdateReport} />}

        <RuntimeStatus coverageNote={catalog?.coverageNote} watchStatus={watchStatus} />
        <AiRecommendBox
          value={taskInput}
          onChange={setTaskInput}
          onSubmit={handleRecommend}
          loading={recommending}
          recommendation={recommendation}
          error={recommendationError}
          itemById={itemById}
          recommendationOnly={recommendationOnly}
          onShowOnly={() => {
            setRecommendationOnly(true);
            setQuery('');
            setFilters(initialFilters);
            setView('cards');
          }}
          onShowAll={() => setRecommendationOnly(false)}
          onSelect={openDetail}
          onCopy={async (text) => {
            await copyText(text);
            setToast('已复制');
          }}
        />

        <section className="toolbar" aria-label="搜索和展示方式">
          <div className="section-heading">
            <div>
              <span>Browse</span>
              <h2>扩展列表</h2>
            </div>
            <p>搜索、筛选、查看调用方式和来源路径。</p>
          </div>
          <div className="toolbar-controls">
            <label className="search-box">
              <Search size={18} />
              <span className="sr-only">搜索扩展</span>
              <input value={query} onChange={(event) => handleQueryChange(event.target.value)} placeholder="搜索名称、用途、调用名、项目或 Marketplace" />
            </label>
            <div className="view-tabs" role="tablist" aria-label="展示方式">
              <ViewButton active={view === 'cards'} onClick={() => setView('cards')} icon={<Grid2X2 size={16} />} label="卡片视图" controls="content-panel" />
              <ViewButton active={view === 'table'} onClick={() => setView('table')} icon={<Table2 size={16} />} label="表格视图" controls="content-panel" />
              <ViewButton active={view === 'project'} onClick={() => setView('project')} icon={<FolderOpen size={16} />} label="按项目" controls="content-panel" />
              <ViewButton active={view === 'category'} onClick={() => setView('category')} icon={<ListFilter size={16} />} label="按分类" controls="content-panel" />
              <ViewButton active={view === 'plugin'} onClick={() => setView('plugin')} icon={<Layers3 size={16} />} label="按 Plugin" controls="content-panel" />
            </div>
          </div>
        </section>

        {toast && <div className="toast" role="status" onAnimationEnd={() => setToast('')}>{toast}</div>}
        {error && <StatePanel tone="error" title="扫描或读取失败" text={error} />}
        {loading && <StatePanel title="加载中" text="正在读取本地扩展扫描结果。" />}
        {!loading && !error && catalog && items.length === 0 && <StatePanel title="暂无扩展数据" text="当前扫描范围内没有发现可展示的扩展。" />}
        <ActiveConditions
          query={query}
          recommendationOnly={recommendationOnly}
          filters={activeFilterEntries}
          onClear={clearAllConditions}
          count={filtered.length}
        />
        {!loading && catalog && filtered.length === 0 && items.length > 0 && (
          <StatePanel
            title="没有匹配结果"
            text={activeFilterCount ? '当前搜索或筛选条件没有匹配扩展。清除全部条件后可恢复完整列表。' : '当前扫描范围内没有匹配扩展。'}
            action={activeFilterCount ? { label: '清除全部条件', onClick: clearAllConditions } : undefined}
          />
        )}

        {!loading && filtered.length > 0 && (
          <>
            <PaginationBar
              total={filtered.length}
              page={currentPage}
              pageSize={pageSize}
              pageCount={pageCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
            <div id="content-panel" role="tabpanel" aria-label="扩展结果">
              <ContentView view={view} items={paged} selected={selected} onSelect={openDetail} onFavorite={handleFavorite} />
            </div>
            <PaginationBar
              total={filtered.length}
              page={currentPage}
              pageSize={pageSize}
              pageCount={pageCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              compact
            />
          </>
        )}
      </main>

      {selected && (
        <DetailDrawer
          item={selected}
          onClose={closeDetail}
          onCopy={async (text) => {
            await copyText(text);
            setToast('已复制');
          }}
          onFavorite={() => handleFavorite(selected)}
          onOpenPath={async (path) => {
            await openPath(path);
            setToast('已在 Finder 中打开');
          }}
        />
      )}
    </div>
  );
}

function filterValueLabel(key: keyof typeof initialFilters, value: string) {
  if (key === 'enabled') return value === 'enabled' ? '已启用' : '已禁用';
  if (key === 'abnormal') return value === 'yes' ? '存在异常' : value;
  if (key === 'favorite') return value === 'yes' ? '已收藏' : value;
  return value;
}

function displayLocalPath(value: string) {
  return value
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^\/home\/[^/]+/, '~')
    .replace(/^[A-Z]:\\Users\\[^\\]+/i, '~');
}

function parseExplicitExtensionLookup(value: string): { query: string; type: ExtensionType | '' } {
  const normalized = value.trim();
  if (!normalized) return { query: '', type: '' };
  const typeMatch = normalized.match(/^(skill|skills|plugin|plugins|mcp|app|hook)\s+(.+)$/i);
  const type = typeMatch ? extensionTypeFromWord(typeMatch[1]) : '';
  const body = (typeMatch ? typeMatch[2] : normalized)
    .replace(/^(搜索|查找|寻找|找一下|找)\s*/i, '')
    .trim();
  const token = body.match(/\$?[a-z0-9][a-z0-9._:-]*[a-z0-9]/i)?.[0] || '';
  if (!token) return { query: '', type };
  const query = token.replace(/^\$/, '');
  const looksLikeExtensionName = query.includes('-') || query.includes(':') || Boolean(type);
  return looksLikeExtensionName ? { query, type } : { query: '', type };
}

function extensionTypeFromWord(word: string): ExtensionType | '' {
  const lower = word.toLowerCase();
  if (lower.startsWith('skill')) return 'Skill';
  if (lower.startsWith('plugin')) return 'Plugin';
  if (lower === 'mcp') return 'MCP';
  if (lower === 'app') return 'App';
  if (lower === 'hook') return 'Hook';
  return '';
}

function AiRecommendBox({
  value,
  onChange,
  onSubmit,
  loading,
  recommendation,
  error,
  itemById,
  recommendationOnly,
  onShowOnly,
  onShowAll,
  onSelect,
  onCopy
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  recommendation: RecommendationResponse | null;
  error: string;
  itemById: Map<string, ExtensionItem>;
  recommendationOnly: boolean;
  onShowOnly: () => void;
  onShowAll: () => void;
  onSelect: (item: ExtensionItem) => void;
  onCopy: (text: string) => void;
}) {
  const results = recommendation?.results || [];
  return (
    <section className="ai-recommend" aria-label="任务智能推荐">
      <div className="section-heading ai-heading">
        <div>
          <span>Recommend</span>
          <h2>用任务找到合适扩展</h2>
        </div>
        <p>描述要做的事，或直接输入扩展名；明确命中时会同步筛选下方列表。</p>
      </div>
      <form
        className="ai-recommend-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="ai-task-box">
          <Sparkles size={18} />
          <span className="sr-only">任务描述</span>
          <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="描述任务或输入扩展名，例如：b2b-product-ux-review / 把报价表整理成方案 PPT" />
        </label>
        <button className="primary-button" type="submit" disabled={loading}>
          <Sparkles size={17} className={loading ? 'spinning' : ''} />
          {loading ? '推荐中' : '推荐插件'}
        </button>
      </form>

      {recommendation && (
        <div className="ai-recommend-body">
          <div className="ai-recommend-head">
            <div>
              <strong>{recommendation.summary}</strong>
              <span>{recommendation.capabilityNote}</span>
            </div>
            <div className="ai-recommend-actions">
              {results.length > 0 && (
                recommendationOnly
                  ? <button type="button" onClick={onShowAll}>显示全部</button>
                  : <button type="button" onClick={onShowOnly}>只看推荐</button>
              )}
            </div>
          </div>
          {recommendation.matchedIntents.length > 0 && (
            <div className="intent-row">
              {recommendation.matchedIntents.map((intent) => <Tag key={intent} text={intent} tone="ok" />)}
            </div>
          )}
          {results.length > 0 ? (
            <div className="recommendation-list">
              {results.slice(0, 6).map((result) => (
                <RecommendationCard
                  key={result.id}
                  result={result}
                  item={itemById.get(result.id)}
                  onSelect={onSelect}
                  onCopy={onCopy}
                />
              ))}
            </div>
          ) : (
            <p className="muted">没有找到足够相关的扩展。</p>
          )}
        </div>
      )}
      {error && <p className="ai-recommend-error" role="alert">{error}</p>}
    </section>
  );
}

function ActiveConditions({
  query,
  recommendationOnly,
  filters,
  onClear,
  count
}: {
  query: string;
  recommendationOnly: boolean;
  filters: string[];
  onClear: () => void;
  count: number;
}) {
  const chips = [
    ...(recommendationOnly ? ['仅显示推荐'] : []),
    ...(query.trim() ? [`搜索：${query.trim()}`] : []),
    ...filters
  ];
  if (chips.length === 0) return null;
  return (
    <section className="active-conditions" aria-label="当前生效条件">
      <div>
        {chips.map((chip) => <Tag key={chip} text={chip} tone={recommendationOnly && chip === '仅显示推荐' ? 'warn' : undefined} />)}
      </div>
      <span>当前 {count} 个匹配项</span>
      <button type="button" onClick={onClear}>清除全部条件</button>
    </section>
  );
}

function PaginationBar({
  total,
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  compact = false
}: {
  total: number;
  page: number;
  pageSize: (typeof PAGE_SIZE_OPTIONS)[number];
  pageCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: (typeof PAGE_SIZE_OPTIONS)[number]) => void;
  compact?: boolean;
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <nav className={compact ? 'pagination compact' : 'pagination'} aria-label={compact ? '底部分页' : '分页'}>
      <span>{start}-{end} / {total}</span>
      <label>
        <span>每页</span>
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}>
          {PAGE_SIZE_OPTIONS.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      <div className="pagination-actions">
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>上一页</button>
        <span>{page} / {pageCount}</span>
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page >= pageCount}>下一页</button>
      </div>
    </nav>
  );
}

function RecommendationCard({ result, item, onSelect, onCopy }: { result: RecommendationResult; item?: ExtensionItem; onSelect: (item: ExtensionItem) => void; onCopy: (text: string) => void }) {
  return (
    <article className="recommendation-card">
      <div className="recommendation-title">
        <div>
          <h2>{result.displayName}</h2>
          <p>{result.invokeSyntax} · 置信度 {result.confidence}</p>
        </div>
        <Tag text={result.type} kind={result.type} />
      </div>
      <p>{result.usageHint}</p>
      <ul>
        {result.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      <div className="recommendation-card-actions">
        <button type="button" onClick={() => onCopy(result.invokeSyntax)} aria-label={`复制 ${result.displayName} 调用`}><Copy size={15} />复制调用</button>
        {item && <button type="button" onClick={() => onSelect(item)} aria-label={`查看 ${result.displayName} 详情`}>查看详情</button>}
      </div>
    </article>
  );
}

function RuntimeStatus({ coverageNote, watchStatus }: { coverageNote?: string; watchStatus: WatchStatus | null }) {
  const stateText = watchStatusLabel(watchStatus);
  const tone = watchStatus?.status === 'error' || watchStatus?.status === 'disabled' ? 'warn' : 'ok';
  return (
    <section className="runtime-status" aria-label="运行状态和扫描覆盖范围">
      <div className="coverage">
        <Info size={17} />
        <span>{coverageNote || '扫描器会读取本机配置和元数据，不执行任何扩展脚本。'}</span>
      </div>
      <div className={`watch-pill ${tone}`}>
        <Radio size={16} />
        <div>
          <strong>自建扩展自动同步：{stateText}</strong>
          <span>{watchStatus?.note || '本地服务运行时监听自建 Skill / Plugin 元数据变化。'}</span>
        </div>
      </div>
    </section>
  );
}

function watchStatusLabel(status: WatchStatus | null) {
  if (!status) return '读取中';
  if (status.status === 'watching') return `监听中（${status.watched.length} 个来源）`;
  if (status.status === 'pending') return '检测到变化';
  if (status.status === 'scanning') return '同步中';
  if (status.status === 'error') return '同步失败';
  if (status.status === 'disabled') return '未启用';
  if (status.status === 'stopped') return '已停止';
  return status.status || '未知';
}

function UpdateSummary({ report }: { report: NonNullable<CatalogResponse['pluginUpdateReport']> }) {
  return (
    <section className="update-summary" aria-label="插件更新记录">
      <div>
        <span>最近第三方插件检查</span>
        <strong>{formatTime(report.generatedAt)}</strong>
      </div>
      <div>
        <span>候选</span>
        <strong>{report.summary.candidates}</strong>
      </div>
      <div>
        <span>已更新</span>
        <strong>{report.summary.updated}</strong>
      </div>
      <div>
        <span>无变化</span>
        <strong>{report.summary.checkedNoChange}</strong>
      </div>
      <div>
        <span>失败</span>
        <strong>{report.summary.failed}</strong>
      </div>
      <div>
        <span>跳过自建</span>
        <strong>{report.summary.skippedSelfBuilt}</strong>
      </div>
      <p>{report.policy.note}</p>
      <details className="update-details">
        <summary>查看更新明细</summary>
        <div className="update-records">
          {report.records.length ? report.records.map((record) => (
            <article key={record.pluginId}>
              <strong>{record.name}</strong>
              <span>{record.marketplaceName || '未知 Marketplace'} · {updateStatusLabel(record.status)}</span>
              <p>{record.message}</p>
              <code>{record.beforeVersion || '未知'} -&gt; {record.afterVersion || '未知'}</code>
            </article>
          )) : <p className="muted">暂无更新记录。</p>}
        </div>
      </details>
    </section>
  );
}

function Summary({
  summary,
  activeKey,
  onSelect
}: {
  summary: CatalogResponse['summary'];
  activeKey: SummaryMetricKey | '';
  onSelect: (key: SummaryMetricKey) => void;
}) {
  const cards: Array<[string, number, typeof Boxes, SummaryMetricKey, string]> = [
    ['总扩展', summary.total, Boxes, 'all', '显示全部扩展'],
    ['Plugin', summary.byType.Plugin || 0, Layers3, 'Plugin', '只看 Plugin'],
    ['Skill', summary.byType.Skill || 0, CheckCircle2, 'Skill', '只看 Skill'],
    ['MCP', summary.byType.MCP || 0, Database, 'MCP', '只看 MCP'],
    ['项目级', summary.project, FolderOpen, 'project', '只看项目级扩展'],
    ['全局', summary.global, Boxes, 'global', '只看全局/用户级扩展'],
    ['已禁用', summary.disabled, AlertTriangle, 'disabled', '只看已禁用扩展'],
    ['异常', summary.abnormal, AlertTriangle, 'abnormal', '只看存在异常的扩展']
  ];
  return (
    <section className="summary-grid" aria-label="扩展统计">
      {cards.map(([label, value, Icon, key, title]) => (
        <button
          className={`metric metric-${metricTone(label)} ${activeKey === key ? 'active' : ''}`}
          key={key}
          type="button"
          aria-pressed={activeKey === key}
          title={title}
          onClick={() => onSelect(key)}
        >
          {React.createElement(Icon, { size: 18 })}
          <span>{label}</span>
          <strong>{value}</strong>
        </button>
      ))}
    </section>
  );
}

function metricTone(label: string) {
  if (label === '总扩展') return 'primary';
  if (label === '异常') return 'warn';
  if (label === '已禁用') return 'muted';
  return 'default';
}

function activeSummaryKey(filters: typeof initialFilters, query: string, recommendationOnly: boolean): SummaryMetricKey | '' {
  if (query.trim() || recommendationOnly) return '';
  const activeFilters = (Object.entries(filters) as Array<[keyof typeof filters, string]>).filter(([, value]) => value);
  if (activeFilters.length === 0) return 'all';
  if (activeFilters.length > 1) return '';
  const [[key, value]] = activeFilters;
  if (key === 'type' && ['Plugin', 'Skill', 'MCP'].includes(value)) return value as SummaryMetricKey;
  if (key === 'scope' && value === '项目级') return 'project';
  if (key === 'scope' && value === '全局/用户级') return 'global';
  if (key === 'enabled' && value === 'disabled') return 'disabled';
  if (key === 'abnormal' && value === 'yes') return 'abnormal';
  return '';
}

function FilterPanel({
  id,
  filters,
  categories,
  scopes,
  projects,
  marketplaces,
  onChange,
  onReset,
  collapsed
}: {
  id: string;
  filters: typeof initialFilters;
  categories: string[];
  scopes: string[];
  projects: string[];
  marketplaces: string[];
  onChange: (key: keyof typeof initialFilters, value: string) => void;
  onReset: () => void;
  collapsed: boolean;
}) {
  return (
    <section id={id} className={collapsed ? 'filters collapsed' : 'filters'} aria-label="筛选条件">
      <div className="filter-head">
        <span>筛选</span>
        <button type="button" onClick={onReset}>清空</button>
      </div>
      <Select label="扩展类型" value={filters.type} values={[...TYPES]} onChange={(value) => onChange('type', value)} />
      <Select label="功能分类" value={filters.category} values={categories} onChange={(value) => onChange('category', value)} />
      <Select label="安装范围" value={filters.scope} values={scopes} onChange={(value) => onChange('scope', value)} />
      <Select label="所属项目" value={filters.project} values={projects} onChange={(value) => onChange('project', value)} />
      <Select label="启用状态" value={filters.enabled} values={['enabled:已启用', 'disabled:已禁用']} onChange={(value) => onChange('enabled', value)} keyed />
      <Select label="Marketplace" value={filters.marketplace} values={marketplaces} onChange={(value) => onChange('marketplace', value)} />
      <Select label="组件关系" value={filters.component} values={['独立扩展', 'Plugin 内置组件']} onChange={(value) => onChange('component', value)} />
      <Select label="异常状态" value={filters.abnormal} values={['yes:存在异常']} onChange={(value) => onChange('abnormal', value)} keyed />
      <Select label="收藏" value={filters.favorite} values={['yes:已收藏']} onChange={(value) => onChange('favorite', value)} keyed />
    </section>
  );
}

function Select({ label, value, values, onChange, keyed = false }: { label: string; value: string; values: readonly string[]; onChange: (value: string) => void; keyed?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">全部</option>
        {values.map((item) => {
          const [key, display] = keyed ? item.split(':') : [item, item];
          return <option value={key} key={item}>{display}</option>;
        })}
      </select>
    </label>
  );
}

function ViewButton({ active, onClick, icon, label, controls }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; controls: string }) {
  return (
    <button className={active ? 'active' : ''} type="button" role="tab" aria-selected={active} aria-controls={controls} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function ContentView({ view, items, selected, onSelect, onFavorite }: { view: ViewMode; items: ExtensionItem[]; selected: ExtensionItem | null; onSelect: (item: ExtensionItem) => void; onFavorite: (item: ExtensionItem) => void }) {
  if (view === 'table') return <ExtensionTable items={items} onSelect={onSelect} />;
  if (view === 'cards') return <CardGrid items={items} selected={selected} onSelect={onSelect} onFavorite={onFavorite} />;
  const groups = groupBy(items, view);
  return (
    <div className="group-list">
      {[...groups.entries()].map(([name, group]) => (
        <section className="group-section" key={name}>
          <div className="group-title">
            <h2>{name}</h2>
            <span>{group.length} 个扩展</span>
          </div>
          <CardGrid items={group} selected={selected} onSelect={onSelect} onFavorite={onFavorite} />
        </section>
      ))}
    </div>
  );
}

function CardGrid({ items, selected, onSelect, onFavorite }: { items: ExtensionItem[]; selected: ExtensionItem | null; onSelect: (item: ExtensionItem) => void; onFavorite: (item: ExtensionItem) => void }) {
  return (
    <section className="card-grid" aria-label="扩展卡片">
      {items.map((item) => (
        <article className={selected?.id === item.id ? 'extension-card selected' : 'extension-card'} key={item.id}>
          <div className="card-top">
            <div>
              <h2>{item.displayName}</h2>
              <p>{item.invokeName || item.name}</p>
            </div>
            <button className={item.favorite ? 'star active' : 'star'} type="button" aria-label={`收藏 ${item.displayName}`} onClick={() => onFavorite(item)}>
              <Star size={17} />
            </button>
          </div>
          <div className="tags">
            <Tag text={item.type} kind={item.type} />
            <Tag text={item.scope} />
            <Tag text={item.enabled ? '已启用' : '已禁用'} tone={item.enabled ? 'ok' : 'warn'} />
            {!['正常', '禁用'].includes(item.status) && <Tag text={item.status} tone="warn" />}
            {item.updateStatus && <Tag text={`更新: ${updateStatusLabel(item.updateStatus)}`} tone={item.updateStatus === 'failed' ? 'warn' : 'ok'} />}
            {item.parentPlugin && <Tag text={`父 Plugin: ${item.parentPlugin}`} />}
          </div>
          <p className="purpose">{item.purposeZh}</p>
          <div className="prompt-block">
            <span>基础提示词</span>
            <code>{item.basicPrompt}</code>
          </div>
          <div className="card-actions">
            <CopyButton text={item.invokeSyntax || item.invokeName} label="复制调用名" itemName={item.displayName} />
            <CopyButton text={item.basicPrompt} label="复制提示词" itemName={item.displayName} />
            <CopyButton text={item.sourcePathCompact || item.sourcePath} label="复制路径" itemName={item.displayName} />
            <button type="button" onClick={() => onSelect(item)} aria-label={`查看 ${item.displayName} 详情`}>查看详情</button>
          </div>
        </article>
      ))}
    </section>
  );
}

function ExtensionTable({ items, onSelect }: { items: ExtensionItem[]; onSelect: (item: ExtensionItem) => void }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>类型</th>
            <th>范围</th>
            <th>作用说明</th>
            <th>调用</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.displayName}</strong>
                <span>{item.name}</span>
              </td>
              <td>{item.type}</td>
              <td>{item.scope}</td>
              <td>{item.purposeZh}</td>
              <td><code>{item.invokeSyntax}</code></td>
              <td>{item.status}</td>
              <td>
                <button type="button" onClick={() => onSelect(item)} aria-label={`查看 ${item.displayName} 详情`}>查看详情</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({
  item,
  onClose,
  onCopy,
  onFavorite,
  onOpenPath
}: {
  item: ExtensionItem;
  onClose: () => void;
  onCopy: (text: string) => void;
  onFavorite: () => void;
  onOpenPath: (path: string) => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [item.id]);

  return (
    <dialog
      className="drawer"
      open
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="drawer-head">
        <div>
          <h2 id="detail-title">{item.displayName}</h2>
          <p>{item.invokeSyntax} · {item.type} · {item.scope}</p>
        </div>
        <div className="drawer-actions">
          <button type="button" onClick={onFavorite} aria-label={`收藏 ${item.displayName}`}>
            <Star size={17} className={item.favorite ? 'filled' : ''} />
          </button>
          <button type="button" onClick={onClose} aria-label="关闭详情" ref={closeButtonRef}>
            <X size={18} />
          </button>
        </div>
      </div>
      <section className="drawer-section lead">
        <h3>完整中文说明</h3>
        <p>{item.purposeZh}</p>
      </section>
      <section className="drawer-section">
        <h3>提示词</h3>
        {[item.basicPrompt, ...item.examplePrompts.filter((prompt) => prompt !== item.basicPrompt)].map((prompt) => (
          <div className="prompt-line" key={prompt}>
            <code>{prompt}</code>
            <button type="button" onClick={() => onCopy(prompt)} aria-label={`复制 ${item.displayName} 提示词`}><Copy size={15} />复制</button>
          </div>
        ))}
        <small>提示词来源：{item.promptSource}</small>
      </section>
      <InfoGrid item={item} />
      <UpdateSection item={item} />
      <ListSection title="典型使用场景" items={item.useCases} />
      <ListSection title="依赖项" items={item.dependencies} empty="未发现显式依赖" />
      <ListSection title="内置 Skills" items={item.bundledSkills} empty="无" />
      <ListSection title="内置 MCP" items={item.bundledMcpServers} empty="无" />
      <ListSection title="内置 Apps / Connectors" items={item.bundledApps} empty="无" />
      <ListSection title="内置 Hooks" items={item.bundledHooks} empty="无" />
      <ListSection title="警告信息" items={item.warnings} empty="无" />
      <section className="drawer-section">
        <h3>原始说明</h3>
        <p className="raw-text">{item.descriptionOriginal || '功能说明待补充'}</p>
      </section>
      <section className="drawer-section">
        <h3>路径</h3>
        <PathRow label="安装路径" value={item.sourcePathCompact || item.sourcePath} onCopy={onCopy} onOpen={() => onOpenPath(item.sourcePath)} />
        {item.documentationPath && <PathRow label="配置入口" value={displayLocalPath(item.documentationPath)} onCopy={onCopy} onOpen={() => onOpenPath(item.documentationPath)} />}
      </section>
    </dialog>
  );
}

function UpdateSection({ item }: { item: ExtensionItem }) {
  if (!item.updateStatus) {
    return (
      <section className="drawer-section">
        <h3>更新记录</h3>
        <p className="muted">暂无第三方插件更新记录</p>
      </section>
    );
  }
  return (
    <section className="drawer-section update-detail">
      <h3>更新记录</h3>
      <div>
        <span>状态</span>
        <strong>{updateStatusLabel(item.updateStatus)}</strong>
      </div>
      <div>
        <span>说明</span>
        <strong>{item.updateMessage || '无'}</strong>
      </div>
      <div>
        <span>检查时间</span>
        <strong>{item.updateCheckedAt ? formatTime(item.updateCheckedAt) : '未知'}</strong>
      </div>
      <div>
        <span>版本变化</span>
        <strong>{item.updateBeforeVersion || '未知'} {'->'} {item.updateAfterVersion || '未知'}</strong>
      </div>
    </section>
  );
}

function updateStatusLabel(status: string) {
  return {
    updated: '已更新',
    'checked-no-change': '已检查无变化',
    checked: '已检查',
    failed: '失败',
    'skipped-self-built': '跳过自建',
    'skipped-managed': '跳过托管'
  }[status] || status;
}

function InfoGrid({ item }: { item: ExtensionItem }) {
  const rows = [
    ['真实名称', item.name],
    ['调用名称', item.invokeName],
    ['所属项目', item.projectName || '无'],
    ['项目根目录', item.projectRootCompact || item.projectRoot || '无'],
    ['Marketplace', item.marketplace || '无'],
    ['父 Plugin', item.parentPlugin || '无'],
    ['版本', item.version || '未知'],
    ['作者', item.author || '未知'],
    ['启用状态', item.enabled ? '已启用' : '已禁用'],
    ['状态', item.status],
    ['更新状态', item.updateStatus ? updateStatusLabel(item.updateStatus) : '暂无记录'],
    ['来源', item.source || '未知'],
    ['最近修改', item.lastModified ? formatTime(item.lastModified) : '未知']
  ];
  return (
    <section className="drawer-section info-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </section>
  );
}

function ListSection({ title, items, empty = '暂无' }: { title: string; items: string[]; empty?: string }) {
  return (
    <section className="drawer-section">
      <h3>{title}</h3>
      {items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">{empty}</p>}
    </section>
  );
}

function PathRow({ label, value, onCopy, onOpen }: { label: string; value: string; onCopy: (text: string) => void; onOpen: () => void }) {
  return (
    <div className="path-row">
      <span>{label}</span>
      <code>{value}</code>
      <button type="button" onClick={() => onCopy(value)} aria-label={`复制${label}`}><Copy size={15} />复制</button>
      <button type="button" onClick={onOpen} aria-label={`打开${label}`}><ExternalLink size={15} />打开</button>
    </div>
  );
}

function Tag({ text, kind, tone }: { text: string; kind?: ExtensionType; tone?: 'ok' | 'warn' }) {
  return <span className={`tag ${kind ? `type-${kind.toLowerCase()}` : ''} ${tone || ''}`}>{text}</span>;
}

function CopyButton({ text, label, itemName }: { text: string; label: string; itemName?: string }) {
  return (
    <button type="button" onClick={() => copyText(text)} title={label} aria-label={itemName ? `${label}：${itemName}` : label}>
      <Copy size={15} />
      {label}
    </button>
  );
}

function StatePanel({ title, text, tone = 'neutral', action }: { title: string; text: string; tone?: 'neutral' | 'error'; action?: { label: string; onClick: () => void } }) {
  return (
    <section className={`state-panel ${tone}`}>
      <h2>{title}</h2>
      <p>{text}</p>
      {action && <button type="button" onClick={action.onClick}>{action.label}</button>}
    </section>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

window.__codexExtensionHubRoot ??= createRoot(rootElement);
window.__codexExtensionHubRoot.render(<App />);
