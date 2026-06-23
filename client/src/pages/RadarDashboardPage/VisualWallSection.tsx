import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRIORITY_STYLE, TYPE_STYLE, screenshotUrl } from '@/lib/badgeStyles';
import { TYPE_LABELS } from '@/lib/filterConfig';
import type { IEntity } from '@/api/types';

export default function VisualWallSection({ entities }: { entities: IEntity[] }) {
  const cards = entities
    .filter((e) => e.visuals && e.visuals.length > 0)
    .flatMap((e) => (e.visuals || []).map((v) => ({ entity: e, visual: v })));

  if (cards.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
        当前筛选下没有视觉预览。可以切回“全部机会”或清空搜索。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(({ entity, visual }) => (
        <a
          key={`${entity.id}-${visual.url}`}
          href={visual.url}
          target="_blank"
          rel="noreferrer"
          className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg"
        >
          <img
            src={screenshotUrl(visual.url)}
            alt={`${entity.name} - ${visual.title}`}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-44 w-full object-cover transition-transform group-hover:scale-105"
          />
          <div className="p-3">
            <h3 className="truncate text-sm font-semibold">{entity.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {visual.title} · {visual.caption}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className={cn('border', PRIORITY_STYLE[entity.priority])}>
                {entity.priority}
              </Badge>
              <Badge variant="outline" className={cn('border', TYPE_STYLE[entity.type])}>
                {TYPE_LABELS[entity.type]}
              </Badge>
              {(entity.tags || []).slice(0, 2).map((t) => (
                <Badge key={t} variant="secondary" className="font-normal">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
