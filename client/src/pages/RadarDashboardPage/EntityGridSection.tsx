import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { PRIORITY_STYLE, TYPE_STYLE, isBoothUncertain } from '@/lib/badgeStyles';
import { TYPE_LABELS, ENGAGEMENT_STATUS_OPTIONS } from '@/lib/filterConfig';
import { ENGAGEMENT_STATUS_STYLE } from '@/lib/badgeStyles';
import type { IEntity, IEngagement, IEvent } from '@/api/types';
import { MapPin } from 'lucide-react';

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
  return (
    <HoverCard openDelay={400} closeDelay={100}>
      <HoverCardTrigger asChild>
        <motion.button
          type="button"
          onClick={onOpen}
          whileHover={{ y: -3 }}
          className={cn(
            'flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-lg',
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold">{entity.name}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {TYPE_LABELS[entity.type]} · {entity.region}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <span className="text-lg font-bold leading-none text-primary">{entity.score}</span>
              <span className="text-[10px] text-muted-foreground">匹配分</span>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="outline" className={cn('border', PRIORITY_STYLE[entity.priority])}>
              {entity.priority} 优先
            </Badge>
            {(entity.events || []).map((id) => (
              <Badge key={id} variant="outline" className="border-border text-muted-foreground">
                {eventShort(id)}
              </Badge>
            ))}
          </div>

          {entity.booth && (
            <p
              className={cn(
                'mt-2 flex items-center gap-1 text-xs',
                isBoothUncertain(entity.booth) ? 'text-amber-600' : 'text-muted-foreground',
              )}
            >
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{entity.booth}</span>
            </p>
          )}

          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {entity.reason}
          </p>

          <div className="mt-auto flex flex-wrap gap-1 pt-3">
            <Badge variant="outline" className={cn('border', TYPE_STYLE[entity.type])}>
              {TYPE_LABELS[entity.type]}
            </Badge>
            {(entity.tags || []).slice(0, 3).map((t) => (
              <Badge key={t} variant="secondary" className="font-normal">
                {t}
              </Badge>
            ))}
          </div>

          <div className="mt-2 border-t pt-2">
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
