import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import {
  PRIORITY_STYLE,
  TYPE_STYLE,
  PRIORITY_CARD,
  ENGAGEMENT_STATUS_STYLE,
  eventBadgeColor,
  isBoothUncertain,
} from '@/lib/badgeStyles';
import { TYPE_LABELS } from '@/lib/filterConfig';
import type { IEntity, IEngagement, IEvent } from '@/api/types';
import { MapPin } from 'lucide-react';

function EventBadge({ short }: { short: string }) {
  return (
    <div className="flex w-11 flex-col overflow-hidden rounded-md border border-black/10 shadow-sm">
      <div
        className="flex h-7 items-center justify-center text-sm font-bold text-white"
        style={{ background: eventBadgeColor(short) }}
      >
        {short}
      </div>
      <span className="bg-white/90 py-0.5 text-center text-[10px] font-bold text-slate-600">
        展会
      </span>
    </div>
  );
}

function EntityCard({
  entity,
  engagement,
  eventShort,
  onOpen,
}: {
  entity: IEntity;
  engagement?: IEngagement;
  eventShort: (id: string) => string;
  onOpen: () => void;
}) {
  const status = engagement?.status || '待评估';
  const card = PRIORITY_CARD[entity.priority];

  return (
    <HoverCard openDelay={450} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.button
          type="button"
          onClick={onOpen}
          whileHover={{ y: -4 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{ borderLeftColor: card.borderLeftColor, background: card.background }}
          className="elev-card flex h-full w-full flex-col rounded-xl border border-l-[6px] border-border/70 p-4 text-left transition-shadow hover:shadow-xl"
        >
          {/* 头部：名称/类型 + 展会徽章/匹配分 */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-bold leading-snug">{entity.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {TYPE_LABELS[entity.type]} · {entity.region}
              </p>
            </div>
            <div className="flex shrink-0 items-start gap-2">
              <div className="flex max-w-[120px] flex-wrap justify-end gap-1">
                {(entity.events || []).map((id) => (
                  <EventBadge key={id} short={eventShort(id)} />
                ))}
              </div>
              <div className="flex flex-col items-center rounded-lg bg-white/70 px-2 py-1 shadow-sm">
                <span className="text-lg font-extrabold leading-none text-primary">
                  {entity.score}
                </span>
                <span className="mt-0.5 text-[10px] text-muted-foreground">匹配分</span>
              </div>
            </div>
          </div>

          {/* 优先级 + 标签 chips */}
          <div className="mt-3 flex flex-wrap gap-1">
            <Badge variant="outline" className={cn('border font-bold', PRIORITY_STYLE[entity.priority])}>
              {entity.priority} 优先
            </Badge>
            {(entity.tags || []).slice(0, 4).map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>

          {/* 展位线索 */}
          {entity.booth && (
            <div
              className={cn(
                'mt-3 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold',
                isBoothUncertain(entity.booth)
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700',
              )}
            >
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                {isBoothUncertain(entity.booth) ? '位置线索' : '展位'}：{entity.booth}
              </span>
            </div>
          )}

          {/* 推荐理由 */}
          <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-600">{entity.reason}</p>

          {/* 底部：类型徽章 + 建联状态 */}
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-black/5 pt-3">
            <Badge variant="outline" className={cn('border', TYPE_STYLE[entity.type])}>
              {TYPE_LABELS[entity.type]}
            </Badge>
            <Badge
              variant="outline"
              className={cn('border', ENGAGEMENT_STATUS_STYLE[status] || ENGAGEMENT_STATUS_STYLE['待评估'])}
            >
              建联：{status}
            </Badge>
          </div>
        </motion.button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="right">
        <h4 className="text-sm font-semibold">{entity.name}</h4>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{entity.reason}</p>
        {entity.cases && entity.cases.length > 0 && (
          <p className="mt-2 text-xs">
            <span className="font-medium">代表案例：</span>
            <span className="text-muted-foreground">{entity.cases.join(' · ')}</span>
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">点击卡片查看完整信息并维护建联状态</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export default function EntityGridSection({
  entities,
  engagementMap,
  events,
  onOpenEntity,
}: {
  entities: IEntity[];
  engagementMap: Map<string, IEngagement>;
  events: IEvent[];
  onOpenEntity: (entity: IEntity) => void;
}) {
  const eventShort = (id: string) => events.find((e) => e.id === id)?.short || id;

  if (entities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        没有匹配结果。可以放宽优先级或清空搜索词。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-2">
      {entities.map((entity) => (
        <EntityCard
          key={entity.id}
          entity={entity}
          engagement={engagementMap.get(entity.id)}
          eventShort={eventShort}
          onOpen={() => onOpenEntity(entity)}
        />
      ))}
    </div>
  );
}
