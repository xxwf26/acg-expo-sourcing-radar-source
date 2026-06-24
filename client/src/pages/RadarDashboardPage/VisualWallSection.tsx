import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PRIORITY_STYLE, TYPE_STYLE, PRIORITY_CARD, screenshotUrl } from '@/lib/badgeStyles';
import { TYPE_LABELS } from '@/lib/filterConfig';
import type { IEntity, IVisual } from '@/api/types';
import { ExternalLink } from 'lucide-react';

function GalleryCard({ entity, visual }: { entity: IEntity; visual: IVisual }) {
  const card = PRIORITY_CARD[entity.priority];
  return (
    <article
      style={{ borderLeftColor: card.borderLeftColor }}
      className="elev-card flex flex-col overflow-hidden rounded-xl border border-l-[6px] border-border/70 bg-card transition-shadow hover:shadow-xl"
    >
      <a href={visual.url} target="_blank" rel="noreferrer" className="group block overflow-hidden">
        <img
          src={screenshotUrl(visual.url)}
          alt={`${entity.name} - ${visual.title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement;
            el.style.opacity = '0.3';
          }}
          className="aspect-[16/10] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </a>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div>
          <h3 className="font-semibold leading-snug">{entity.name}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {visual.title} · {visual.caption}
          </p>
        </div>

        {/* 优先级 + 类型 + 标签 */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className={cn('border font-bold', PRIORITY_STYLE[entity.priority])}>
            {entity.priority} 优先
          </Badge>
          <Badge variant="outline" className={cn('border', TYPE_STYLE[entity.type])}>
            {TYPE_LABELS[entity.type]}
          </Badge>
          {(entity.tags || []).slice(0, 3).map((t) => (
            <Badge key={t} variant="secondary" className="font-normal">
              {t}
            </Badge>
          ))}
        </div>

        {/* 粉丝数据 */}
        {(entity.followerScale || entity.followerTier) && (
          <div className="rounded-md bg-secondary/50 px-2.5 py-1.5 text-xs">
            <span className="text-muted-foreground">粉丝量级：</span>
            <span className="font-medium">{entity.followerScale || '待复核'}</span>
            {entity.followerTier && (
              <>
                <span className="mx-1 text-border">|</span>
                <span className="text-muted-foreground">分层：</span>
                <span className="font-medium">{entity.followerTier}</span>
              </>
            )}
          </div>
        )}

        {/* 代表案例 */}
        {entity.cases && entity.cases.length > 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">代表案例：</span>
            {entity.cases.join(' · ')}
          </p>
        )}

        {/* 推荐理由（视觉墙也补上，原应用对象卡有，这里精简两行） */}
        {entity.reason && (
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{entity.reason}</p>
        )}

        <a
          href={visual.url}
          target="_blank"
          rel="noreferrer"
          className="mt-auto inline-flex w-fit items-center gap-1 rounded-md border px-2.5 py-1 pt-1.5 text-xs text-info hover:bg-accent"
        >
          打开案例入口
          <ExternalLink className="size-3" />
        </a>
      </div>
    </article>
  );
}

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
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        共 {cards.length} 张视觉预览（来自 {new Set(cards.map((c) => c.entity.id)).size} 个对象）。缩略图为官网/作品集/商店页预览，用于快速判断风格；正式合作前请进入来源页核对版权与最新作品。
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {cards.map(({ entity, visual }) => (
          <GalleryCard key={`${entity.id}-${visual.url}`} entity={entity} visual={visual} />
        ))}
      </div>
    </div>
  );
}
