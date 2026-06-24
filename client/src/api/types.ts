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
