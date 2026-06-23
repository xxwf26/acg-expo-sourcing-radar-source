import type { EntityType, Priority } from '@/api/types';

// 优先级徽章配色（S 青 / A 蓝 / B 灰）—— 卡片与弹窗共用，避免漂移
export const PRIORITY_STYLE: Record<Priority, string> = {
  S: 'bg-teal-50 text-teal-700 border-teal-200',
  A: 'bg-blue-50 text-blue-700 border-blue-200',
  B: 'bg-slate-100 text-slate-600 border-slate-200',
};

// 对象类型徽章配色
export const TYPE_STYLE: Record<EntityType, string> = {
  master: 'bg-rose-50 text-rose-700 border-rose-200',
  creatorKol: 'bg-violet-50 text-violet-700 border-violet-200',
  supplier: 'bg-amber-50 text-amber-700 border-amber-200',
  platform: 'bg-sky-50 text-sky-700 border-sky-200',
};

// 建联状态配色
export const ENGAGEMENT_STATUS_STYLE: Record<string, string> = {
  待评估: 'bg-slate-100 text-slate-600 border-slate-200',
  业务想聊: 'bg-blue-50 text-blue-700 border-blue-200',
  现场拜访: 'bg-amber-50 text-amber-700 border-amber-200',
  已建联: 'bg-green-50 text-green-700 border-green-200',
  搁置: 'bg-slate-100 text-slate-400 border-slate-200',
};

// 优先级卡片渐变 + 左边框色（移植原 entity-card.priority-* 配色）
export const PRIORITY_CARD: Record<Priority, { borderLeftColor: string; background: string }> = {
  S: {
    borderLeftColor: '#c94156',
    background: 'linear-gradient(160deg, #fff3f6 0%, #ffffff 52%, #ffe7ec 100%)',
  },
  A: {
    borderLeftColor: '#c78318',
    background: 'linear-gradient(160deg, #fff8e8 0%, #ffffff 54%, #fdf0cc 100%)',
  },
  B: {
    borderLeftColor: '#18867d',
    background: 'linear-gradient(160deg, #edf8f7 0%, #ffffff 54%, #e0f2ef 100%)',
  },
};

// 展会徽章配色（移植原 .event-badge.<short> strong 背景色）
const EVENT_BADGE_COLOR: Record<string, string> = {
  ax: '#e34d5f',
  gc: '#2257c8',
  bw: '#00a1d6',
  cj: '#d6422b',
  tgs: '#222f3e',
  wf: '#7f3fbf',
  c106: '#2c8f5b',
  aj: '#f08a24',
  afa: '#bd315d',
  gaf: '#6b7280',
};

export function eventBadgeColor(short: string): string {
  const key = short.toLowerCase().replace(/[^a-z0-9]/g, '');
  return EVENT_BADGE_COLOR[key] || '#6b7280';
}

// WordPress mShots 网页截图（原应用同款视觉预览）
export function screenshotUrl(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=760`;
}

// 展位是否为“位置线索”（不确定）——移植原 boothMarkup 判定
const UNCERTAIN_BOOTH = /待|Schedule|Guest|官方|来源|搜索|特别关注|活动|舞台|线上|现场嘉宾|展商/;
export function isBoothUncertain(booth?: string | null): boolean {
  return !!booth && UNCERTAIN_BOOTH.test(booth);
}
