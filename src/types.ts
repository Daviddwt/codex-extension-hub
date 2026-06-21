export type ExtensionType = 'Plugin' | 'Skill' | 'MCP' | 'App' | 'Hook';
export type ViewMode = 'cards' | 'table' | 'project' | 'category' | 'plugin';

export interface ExtensionItem {
  id: string;
  name: string;
  displayName: string;
  invokeName: string;
  invokeSyntax: string;
  type: ExtensionType;
  componentType: string;
  parentPlugin: string;
  scope: string;
  projectName: string;
  projectRoot: string;
  sourcePath: string;
  resolvedPath: string;
  sourcePathCompact?: string;
  resolvedPathCompact?: string;
  projectRootCompact?: string;
  marketplace: string;
  source: string;
  version: string;
  author: string;
  enabled: boolean;
  status: string;
  descriptionOriginal: string;
  purposeZh: string;
  useCases: string[];
  category: string;
  basicPrompt: string;
  examplePrompts: string[];
  promptSource: string;
  dependencies: string[];
  bundledSkills: string[];
  bundledMcpServers: string[];
  bundledApps: string[];
  bundledHooks: string[];
  documentationPath: string;
  repository: string;
  homepage: string;
  lastModified: string;
  metadataSource: string[];
  warnings: string[];
  updateStatus?: string;
  updateMessage?: string;
  updateCheckedAt?: string;
  updateUpdatedAt?: string;
  updateBeforeVersion?: string;
  updateAfterVersion?: string;
  tags?: string[];
  notes?: string;
  favorite?: boolean;
}

export interface CatalogResponse {
  generatedAt: string;
  coverageNote: string;
  pluginUpdateReport?: PluginUpdateReport | null;
  scanSources: Array<{ label: string; path: string; pathCompact: string; exists: boolean }>;
  warnings: string[];
  summary: {
    total: number;
    byType: Record<ExtensionType, number>;
    project: number;
    global: number;
    disabled: number;
    abnormal: number;
  };
  extensions: ExtensionItem[];
}

export interface WatchStatus {
  enabled: boolean;
  status: 'starting' | 'watching' | 'pending' | 'scanning' | 'error' | 'disabled' | 'stopped' | string;
  watched: Array<{ label: string; path: string; recursive: boolean }>;
  lastEventAt?: string;
  lastScanAt?: string;
  lastError?: string;
  note?: string;
}

export interface HubEvent {
  type: 'watch-status' | 'catalog-updated' | 'catalog-update-failed' | string;
  at: string;
  status?: WatchStatus;
  reason?: string;
  generatedAt?: string;
  summary?: CatalogResponse['summary'];
  error?: string;
}

export interface RecommendationResponse {
  generatedAt: string;
  mode: string;
  task: string;
  capabilityNote: string;
  matchedIntents: string[];
  recommendedIds: string[];
  summary: string;
  results: RecommendationResult[];
}

export interface RecommendationResult {
  id: string;
  name: string;
  displayName: string;
  invokeSyntax: string;
  type: ExtensionType;
  parentPlugin: string;
  category: string;
  score: number;
  confidence: string;
  reasons: string[];
  usageHint: string;
}

export interface PluginUpdateReport {
  generatedAt: string;
  mode: string;
  policy: {
    included: string[];
    skipped: string[];
    note: string;
  };
  summary: {
    total: number;
    candidates: number;
    updated: number;
    checkedNoChange: number;
    failed: number;
    skippedSelfBuilt: number;
    skippedManaged: number;
  };
  records: PluginUpdateRecord[];
}

export interface PluginUpdateRecord {
  pluginId: string;
  name: string;
  marketplaceName: string;
  beforeVersion: string;
  afterVersion: string;
  status: string;
  message: string;
  checkedAt: string;
  updatedAt: string;
}
