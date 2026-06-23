import type { EntityType, Priority } from '@/api/types';

// 对象类型选项（对应原侧边栏“对象类型”）
export const TYPE_OPTIONS: { label: string; value: EntityType }[] = [
  { label: '艺术家/大佬', value: 'master' },
  { label: '画师/KOL', value: 'creatorKol' },
  { label: '供应商/品牌', value: 'supplier' },
  { label: '平台/渠道', value: 'platform' },
];

export const TYPE_LABELS: Record<EntityType, string> = {
  master: '艺术家/行业大佬',
  creatorKol: '画师/KOL',
  supplier: '供应商/品牌',
  platform: '平台/渠道',
};

// 优先级选项
export const PRIORITY_OPTIONS: { label: string; value: Priority }[] = [
  { label: 'S', value: 'S' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
];

// 采购视角（对应原“采购视角”下拉）
export const ANGLE_OPTIONS: { label: string; value: string }[] = [
  { label: '女性向 / 角色向', value: '女性向' },
  { label: '服饰 / 潮流 / Nikki', value: '服饰' },
  { label: '周边 / 零售 / 授权', value: '周边' },
  { label: '线下活动 / 快闪执行', value: '现场' },
  { label: '高端美术 / 收藏视觉', value: '美术' },
];

// 建联状态选项（对应原 localStorage workflow）
export const ENGAGEMENT_STATUS_OPTIONS = [
  '待评估',
  '业务想聊',
  '现场拜访',
  '已建联',
  '搁置',
] as const;
