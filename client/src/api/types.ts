export type LinkPair = [string, string];

export interface IVisual {
  title: string;
  caption: string;
  url: string;
}

export interface IEvent {
  id: string;
  name: string;
  short: string;
  date: string | null;
  month: string | null;
  city: string | null;
  region: string | null;
  venue: string | null;
  status: string | null;
  tags: string[] | null;
  note: string | null;
  links: LinkPair[] | null;
  sortOrder: number;
}

export type EntityType = 'master' | 'creatorKol' | 'supplier' | 'platform';
export type Priority = 'S' | 'A' | 'B';

export interface IEntity {
  id: string;
  name: string;
  type: EntityType;
  priority: Priority;
  score: number;
  events: string[] | null;
  region: string | null;
  booth: string | null;
  followerScale: string | null;
  followerTier: string | null;
  followerNote: string | null;
  tags: string[] | null;
  angles: string[] | null;
  reason: string | null;
  cases: string[] | null;
  visuals: IVisual[] | null;
  links: LinkPair[] | null;
  excluded: boolean;
}

export interface ISource {
  id: string;
  name: string;
  cadence: string | null;
  fields: string | null;
  links: LinkPair[] | null;
  sortOrder: number;
  // ── 自动采集（P1）抓取配置 ──
  url: string | null;
  strategy: string | null; // static | browser | pdf
  selector: string | null;
  eventId: string | null;
  enabled: boolean;
  lastCrawledAt: string | null;
}

export type CandidateStatus = 'pending' | 'promoted' | 'merged' | 'rejected';

export interface ICandidate {
  id: string;
  sourceId: string | null;
  crawlRunId: string | null;
  eventId: string | null;
  name: string;
  type: EntityType;
  region: string | null;
  booth: string | null;
  activityTime: string | null;
  followerScale: string | null;
  links: LinkPair[] | null;
  reason: string | null;
  rawSnippet: string | null;
  aiScore: number | null;
  dedupEntityId: string | null;
  status: CandidateStatus;
  reviewedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICandidateCounts {
  pending: number;
  promoted: number;
  merged: number;
  rejected: number;
}

/** 转正时复核人可携带的修正字段 */
export interface IPromotePayload {
  name?: string;
  type?: EntityType;
  priority?: Priority;
  score?: number;
  region?: string;
  booth?: string;
  followerScale?: string;
  reason?: string;
  events?: string[];
  tags?: string[];
  angles?: string[];
}

export interface ICrawlRunResult {
  runId: string;
  status: 'running' | 'ok' | 'failed';
  extractedCount?: number;
  duplicates?: number;
  error?: string;
}

/** 抓取批次状态（轮询用） */
export interface ICrawlRun {
  id: string;
  sourceId: string;
  status: 'running' | 'ok' | 'failed';
  extractedCount: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** 抓取历史列表项（带信息源名） */
export interface ICrawlRunListItem extends ICrawlRun {
  sourceName: string;
}

export interface IEngagement {
  entityId: string;
  status: string;
  owner: string | null;
  note: string | null;
  updatedBy: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IListResponse<T> {
  list: T[];
  total: number;
}

export type UserRole = 'admin' | 'viewer';

export interface IUser {
  id: string;
  username: string;
  role: UserRole;
  displayName: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IEntityFilter {
  type?: string[];
  priority?: string[];
  event?: string;
  angle?: string;
  keyword?: string;
  includeExcluded?: boolean;
}
