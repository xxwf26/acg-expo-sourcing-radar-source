import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SlidersHorizontal } from 'lucide-react';
import { useEvents, useEntities, useSources } from '@/hooks/useRadarData';
import { useEngagements } from '@/hooks/useEngagement';
import FilterPanelSection, { DEFAULT_FILTERS, type FilterState } from './FilterPanelSection';
import EntityGridSection from './EntityGridSection';
import EntityDetailModal from './EntityDetailModal';
import VisualWallSection from './VisualWallSection';
import EventCalendarSection from './EventCalendarSection';
import SourcesSection from './SourcesSection';
import WorkflowSection from './WorkflowSection';
import type { IEntity, IEngagement } from '@/api/types';

type ViewKey = 'entities' | 'visual' | 'events' | 'sources' | 'workflow';

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: 'entities', label: '建联对象' },
  { key: 'visual', label: '视觉墙' },
  { key: 'events', label: '展会日历' },
  { key: 'sources', label: '信息源监控' },
  { key: 'workflow', label: '落地方案' },
];

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function RadarDashboardPage() {
  const eventsQuery = useEvents();
  const entitiesQuery = useEntities();
  const sourcesQuery = useSources();
  const engagementsQuery = useEngagements();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewKey>('entities');
  const [activeEntity, setActiveEntity] = useState<IEntity | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const events = eventsQuery.data?.list || [];
  const allEntities = entitiesQuery.data?.list || [];
  const sources = sourcesQuery.data?.list || [];

  // 可见对象 = 未被排除（对应原 entities - excludedEntityIds）
  const visibleEntities = useMemo(() => allEntities.filter((e) => !e.excluded), [allEntities]);

  // 建联记录映射
  const engagementMap = useMemo(() => {
    const map = new Map<string, IEngagement>();
    (engagementsQuery.data?.list || []).forEach((e) => map.set(e.entityId, e));
    return map;
  }, [engagementsQuery.data]);

  // 客户端多维过滤（移植原 filteredEntities）
  const filtered = useMemo(() => {
    const kw = filters.search.trim().toLowerCase();
    return visibleEntities
      .filter((e) => {
        if (!kw) return true;
        const hay = [
          e.name,
          e.region,
          e.booth,
          e.reason,
          ...(e.tags || []),
          ...(e.angles || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(kw);
      })
      .filter((e) => filters.event === 'all' || (e.events || []).includes(filters.event))
      .filter((e) => filters.types.length === 0 || filters.types.includes(e.type))
      .filter((e) => filters.priorities.length === 0 || filters.priorities.includes(e.priority))
      .filter((e) => filters.angle === 'all' || (e.angles || []).includes(filters.angle))
      .filter((e) => e.score >= filters.scoreMin)
      .sort((a, b) => b.score - a.score);
  }, [visibleEntities, filters]);

  const openEntity = (entity: IEntity) => {
    setActiveEntity(entity);
    setModalOpen(true);
  };

  const isLoading =
    eventsQuery.isLoading || entitiesQuery.isLoading || sourcesQuery.isLoading;
  const isError = eventsQuery.isError || entitiesQuery.isError || sourcesQuery.isError;

  const filterPanel = (
    <FilterPanelSection filters={filters} onChange={setFilters} events={events} />
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] gap-0">
      {/* PC 侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 overflow-auto border-r bg-sidebar p-4 lg:block">
        <div className="mb-5">
          <h1 className="text-base font-bold leading-tight">采购寻源建联雷达</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">游戏 / ACG / 美术展会机会池</p>
        </div>
        {filterPanel}
      </aside>

      {/* 主区 */}
      <main className="min-w-0 flex-1 p-4 sm:p-6">
        {/* 顶部：标题 + 移动端筛选入口 + 统计 */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">从“参加展会”升级成“全组可复用的机会雷达”</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
              把展会里的艺术家、大厂嘉宾、周边供应商、零售渠道和社区节点沉淀给整个组。业务方提前筛选想建联的人，采购按优先级安排现场拜访。
            </p>
          </div>
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal className="size-4" />
                  筛选
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                <SheetTitle className="mb-4">筛选条件</SheetTitle>
                {filterPanel}
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard value={events.length} label="重点展会" />
          <StatCard value={visibleEntities.length} label="候选对象" />
          <StatCard
            value={visibleEntities.filter((e) => e.priority === 'S' || e.priority === 'A').length}
            label="S/A 优先级"
          />
          <StatCard value={sources.length} label="待监控来源" />
        </div>

        {/* 视图 Tab */}
        <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)} className="mb-4">
          <TabsList>
            {VIEW_TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* 内容 */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-destructive">
            数据加载失败。请确认后端服务已启动（端口 3002），然后刷新页面。
          </div>
        ) : (
          <>
            {view === 'entities' && (
              <div className="text-xs text-muted-foreground">
                <p className="mb-3">
                  共 {filtered.length} 个匹配对象（按匹配分排序）。点击卡片查看完整信息并维护建联状态。
                </p>
                <EntityGridSection
                  entities={filtered}
                  engagementMap={engagementMap}
                  events={events}
                  onOpenEntity={openEntity}
                />
              </div>
            )}
            {view === 'visual' && <VisualWallSection entities={filtered} />}
            {view === 'events' && <EventCalendarSection events={events} />}
            {view === 'sources' && <SourcesSection sources={sources} />}
            {view === 'workflow' && <WorkflowSection />}
          </>
        )}
      </main>

      <EntityDetailModal
        entity={activeEntity}
        engagement={activeEntity ? engagementMap.get(activeEntity.id) : undefined}
        events={events}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
}
