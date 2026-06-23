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

// WordPress mShots 网页截图（原应用同款视觉预览）
export function screenshotUrl(url: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=760`;
}

// 展位是否为“位置线索”（不确定）——移植原 boothMarkup 判定
const UNCERTAIN_BOOTH = /待|Schedule|Guest|官方|来源|搜索|特别关注|活动|舞台|线上|现场嘉宾|展商/;
export function isBoothUncertain(booth?: string | null): boolean {
  return !!booth && UNCERTAIN_BOOTH.test(booth);
}
