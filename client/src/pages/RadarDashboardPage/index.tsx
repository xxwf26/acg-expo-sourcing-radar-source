import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SlidersHorizontal, Radar, LogOut, Plus, KeyRound, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEvents, useEntities, useSources } from '@/hooks/useRadarData';
import { useEngagements } from '@/hooks/useEngagement';
import { useCrawlRunNotifications } from '@/hooks/useCrawl';
import { useEventMutations, useSourceMutations } from '@/hooks/useCrudMutations';
import FilterPanelSection, { DEFAULT_FILTERS, type FilterState } from './FilterPanelSection';
import EntityGridSection from './EntityGridSection';
import EntityDetailModal from './EntityDetailModal';
import SimpleEditModal, { type SimpleField } from './SimpleEditModal';
import VisualWallSection from './VisualWallSection';
import EventCalendarSection from './EventCalendarSection';
import SourcesSection from './SourcesSection';
import CandidateReviewSection from './CandidateReviewSection';
import EngagementBoardSection from './EngagementBoardSection';
import WorkflowSection from './WorkflowSection';
import EntitySidePanel from './EntitySidePanel';
import AiChatPanel from '@/components/AiChatPanel';
import ChangePasswordModal from './ChangePasswordModal';
import UserManageModal from './UserManageModal';
import BackToTop from './BackToTop';
import type { IEntity, IEngagement, IEvent, ISource } from '@/api/types';

const EVENT_FIELDS: SimpleField[] = [
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '展会全名' },
  { key: 'short', label: '短名/徽章', type: 'text', required: true, placeholder: '如 AX' },
  { key: 'date', label: '日期', type: 'text', placeholder: '如 2026-07-02 至 2026-07-05' },
  { key: 'month', label: '月份', type: 'text', placeholder: '如 7月' },
  { key: 'city', label: '城市', type: 'text', placeholder: '如 美国 洛杉矶' },
  { key: 'region', label: '地区', type: 'text', placeholder: '如 北美' },
  { key: 'venue', label: '场馆', type: 'text' },
  { key: 'status', label: '状态', type: 'text', placeholder: '如 名单更新中' },
  { key: 'tags', label: '标签', type: 'chips', placeholder: '输入后回车' },
  { key: 'note', label: '采购侧说明', type: 'textarea' },
  { key: 'links', label: '链接', type: 'links' },
];

const SOURCE_FIELDS_BASE: SimpleField[] = [
  { key: 'name', label: '名称', type: 'text', required: true, placeholder: '信息源名称' },
  { key: 'cadence', label: '监控频率', type: 'text', placeholder: '如 展前每周' },
  { key: 'fields', label: '字段', type: 'text', placeholder: '如 Exhibitors / Talent' },
  { key: 'links', label: '链接', type: 'links' },
  // ── 自动采集配置 ──
  {
    key: 'url',
    label: '抓取 URL',
    type: 'text',
    placeholder: 'https://… 名单页（非展会首页）',
    hint: '填具体的参展画师/展商名单页地址，留空则该源仅作展示、不抓取。',
  },
  {
    key: 'strategy',
    label: '抓取策略',
    type: 'select',
    options: [
      { label: '静态页（直接抓 HTML，最快）', value: 'static' },
      { label: '浏览器渲染（JS 站，如 AX/gamescom）', value: 'browser' },
      { label: 'PDF 名单', value: 'pdf' },
    ],
    hint: '官网名单多为 JS 渲染，static 抓不到时改用 browser（较慢，需渲染 + 分块抽取，约几分钟）。',
  },
  { key: 'selector', label: 'CSS 选择器（可选）', type: 'text', placeholder: '如 .artist-list，缩小抽取范围、省 token' },
  { key: 'enabled', label: '纳入抓取', type: 'switch', placeholder: '启用后「一键抓取」会包含此源' },
];

/** 源表单字段（含「关联展会」下拉，需运行时注入 events 选项） */
function buildSourceFields(events: IEvent[]): SimpleField[] {
  const fields = [...SOURCE_FIELDS_BASE];
  // 在 selector 之后插入「关联展会」
  const eventField: SimpleField = {
    key: 'eventId',
    label: '关联展会',
    type: 'select',
    options: [{ label: '（不关联）', value: '' }, ...events.map((e) => ({ label: `${e.short} · ${e.name}`, value: e.id }))],
    hint: '抓到的候选会默认归属该展会。',
  };
  const idx = fields.findIndex((f) => f.key === 'selector');
  fields.splice(idx + 1, 0, eventField);
  return fields;
}

type ViewKey = 'entities' | 'candidates' | 'visual' | 'events' | 'sources' | 'board' | 'workflow';

const VIEW_TABS: { key: ViewKey; label: string }[] = [
  { key: 'entities', label: '建联对象' },
  { key: 'candidates', label: '候选复核' },
  { key: 'visual', label: '视觉墙' },
  { key: 'events', label: '展会日历' },
  { key: 'sources', label: '信息源监控' },
  { key: 'board', label: '建联看板' },
  { key: 'workflow', label: '落地方案' },
];

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="glass rounded-lg px-3 py-2 text-white">
      <div className="text-lg font-extrabold leading-none">{value}</div>
      <div className="mt-0.5 text-[11px] text-white/70">{label}</div>
    </div>
  );
}

export default function RadarDashboardPage() {
  const { user, isAdmin, logout } = useAuth();
  const eventsQuery = useEvents();
  const entitiesQuery = useEntities();
  const sourcesQuery = useSources();
  const engagementsQuery = useEngagements();
  // 全局抓取完成通知（run 从 running→ok/failed 时弹 toast）
  useCrawlRunNotifications();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewKey>('entities');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [creatingEntity, setCreatingEntity] = useState(false);

  // 账号相关弹窗
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);

  // events / sources 编辑弹窗状态
  const eventMut = useEventMutations();
  const sourceMut = useSourceMutations();
  const [eventModal, setEventModal] = useState<{ open: boolean; data: Partial<IEvent>; isCreate: boolean }>({
    open: false,
    data: {},
    isCreate: false,
  });
  const [sourceModal, setSourceModal] = useState<{ open: boolean; data: Partial<ISource>; isCreate: boolean }>({
    open: false,
    data: {},
    isCreate: false,
  });

  const events = eventsQuery.data?.list || [];
  const allEntities = entitiesQuery.data?.list || [];
  const sources = sourcesQuery.data?.list || [];

  // 可见对象 = 未被排除（对应原 entities - excludedEntityIds）
  const visibleEntities = useMemo(() => allEntities.filter((e) => !e.excluded), [allEntities]);

  // 当前打开的对象：从最新列表派生，编辑保存后自动同步，避免显示旧数据
  const activeEntity = useMemo(
    () => (activeId ? allEntities.find((e) => e.id === activeId) ?? null : null),
    [activeId, allEntities],
  );

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
      .sort((a, b) => b.score - a.score);
  }, [visibleEntities, filters]);

  const openEntity = (entity: IEntity) => {
    setCreatingEntity(false);
    setActiveId(entity.id);
    setModalOpen(true);
  };

  const openCreateEntity = () => {
    setCreatingEntity(true);
    setActiveId(null);
    setModalOpen(true);
  };

  const isLoading =
    eventsQuery.isLoading || entitiesQuery.isLoading || sourcesQuery.isLoading;
  const isError = eventsQuery.isError || entitiesQuery.isError || sourcesQuery.isError;

  const filterPanel = (
    <FilterPanelSection filters={filters} onChange={setFilters} events={events} />
  );

  return (
    <div className="app-canvas flex min-h-screen w-full gap-0">
      {/* PC 侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col overflow-auto border-r border-border/70 bg-sidebar/80 p-5 backdrop-blur lg:flex">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-teal-600 shadow-md shadow-primary/30">
            <Radar className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold leading-tight">采购寻源建联雷达</h1>
            <p className="mt-0.5 text-[11px] text-muted-foreground">游戏 / ACG / 美术展会机会池</p>
          </div>
        </div>
        {/* AI 全库助手（全局，每个视图可见） */}
        <div className="mb-4">
          <AiChatPanel />
        </div>
        <div className="flex-1">{filterPanel}</div>

        {/* 当前用户 + 账号操作 */}
        <div className="mt-4 border-t pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.displayName || user?.username}</p>
              <p className="text-[11px] text-muted-foreground">
                {isAdmin ? '管理员 · 可维护建联' : '只读用户 · 仅浏览'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="shrink-0">
              <LogOut className="size-4" />
              登出
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <Button variant="ghost" size="sm" onClick={() => setPwdModalOpen(true)} className="h-7 px-2 text-xs">
                  <KeyRound className="size-3.5" />
                  改密码
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setUserModalOpen(true)} className="h-7 px-2 text-xs">
                  <Users className="size-3.5" />
                  账号管理
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {/* 深色雷达 Hero 横幅（紧凑） */}
        <section className="radar-hero mb-4 rounded-2xl p-4 shadow-lg sm:p-5">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-teal-100 backdrop-blur">
                <span className="size-1.5 animate-pulse rounded-full bg-teal-300" />
                实时机会雷达 · 营销采购窗口
              </div>
              <h2 className="text-base font-bold leading-tight text-white sm:text-lg">
                从“参加展会”升级成“全组可复用的机会雷达”
              </h2>
            </div>
            {/* 移动端操作 */}
            <div className="flex shrink-0 items-center gap-2 lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                    <SlidersHorizontal className="size-4" />
                    筛选
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-auto">
                  <SheetTitle className="mb-4">筛选条件</SheetTitle>
                  {filterPanel}
                </SheetContent>
              </Sheet>
              <Button variant="outline" size="sm" onClick={logout} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>

          {/* 统计：玻璃卡 */}
          <div className="relative z-10 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard value={events.length} label="重点展会" />
            <StatCard value={visibleEntities.length} label="候选对象" />
            <StatCard
              value={visibleEntities.filter((e) => e.priority === 'S' || e.priority === 'A').length}
              label="S/A 优先级"
            />
            <StatCard value={sources.length} label="待监控来源" />
          </div>
        </section>

        {/* 视图 Tab —— 下滑时吸顶，随时切换模块 */}
        <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-border/40 bg-background/80 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewKey)}>
            <TabsList className="h-11 gap-1 rounded-xl border bg-card/70 p-1.5 shadow-sm backdrop-blur">
              {VIEW_TABS.map((t) => (
                <TabsTrigger
                  key={t.key}
                  value={t.key}
                  className="rounded-lg px-4 text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-teal-600 data-[state=active]:font-semibold data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:shadow-primary/25"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* 内容 */}
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-destructive">
            数据加载失败。请确认后端服务已启动（端口 3002），然后刷新页面。
          </div>
        ) : (
          <>
            {view === 'entities' && (
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      共 {filtered.length} 个匹配对象（按匹配分排序）。点击卡片查看完整信息并维护建联状态。
                    </p>
                    {isAdmin && (
                      <Button size="sm" onClick={openCreateEntity} className="shrink-0">
                        <Plus className="size-4" />
                        新增对象
                      </Button>
                    )}
                  </div>
                  <EntityGridSection
                    entities={filtered}
                    engagementMap={engagementMap}
                    events={events}
                    onOpenEntity={openEntity}
                  />
                </div>
                <EntitySidePanel />
              </div>
            )}
            {view === 'candidates' && (
              <CandidateReviewSection canEdit={isAdmin} entities={allEntities} />
            )}
            {view === 'visual' && <VisualWallSection entities={filtered} />}
            {view === 'events' && (
              <EventCalendarSection
                events={events}
                canEdit={isAdmin}
                onCreate={() => setEventModal({ open: true, data: { tags: [], links: [] }, isCreate: true })}
                onEdit={(ev) => setEventModal({ open: true, data: ev, isCreate: false })}
              />
            )}
            {view === 'sources' && (
              <SourcesSection
                sources={sources}
                canEdit={isAdmin}
                onCreate={() => setSourceModal({ open: true, data: { links: [] }, isCreate: true })}
                onEdit={(s) => setSourceModal({ open: true, data: s, isCreate: false })}
              />
            )}
            {view === 'board' && (
              <EngagementBoardSection entities={allEntities} engagementMap={engagementMap} events={events} />
            )}
            {view === 'workflow' && <WorkflowSection />}
          </>
        )}
      </main>

      <EntityDetailModal
        entity={activeEntity}
        engagement={activeEntity ? engagementMap.get(activeEntity.id) : undefined}
        events={events}
        canEdit={isAdmin}
        isCreate={creatingEntity}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      {/* 账号：改密码（全角色） + 账号管理（admin） */}
      <ChangePasswordModal open={pwdModalOpen} onOpenChange={setPwdModalOpen} />
      {isAdmin && <UserManageModal open={userModalOpen} onOpenChange={setUserModalOpen} />}

      <BackToTop />

      {/* 展会 新增/编辑 */}
      <SimpleEditModal<IEvent>
        title={eventModal.isCreate ? '新增展会' : `编辑展会：${eventModal.data.name || ''}`}
        fields={EVENT_FIELDS}
        initial={eventModal.data}
        isCreate={eventModal.isCreate}
        open={eventModal.open}
        onOpenChange={(o) => setEventModal((s) => ({ ...s, open: o }))}
        saving={eventMut.create.isPending || eventMut.update.isPending}
        onSave={(data) => {
          if (eventModal.isCreate) {
            eventMut.create.mutate(data, { onSuccess: () => setEventModal((s) => ({ ...s, open: false })) });
          } else {
            eventMut.update.mutate(
              { id: (eventModal.data as IEvent).id, data },
              { onSuccess: () => setEventModal((s) => ({ ...s, open: false })) },
            );
          }
        }}
        onDelete={
          eventModal.isCreate
            ? undefined
            : () => {
                const ev = eventModal.data as IEvent;
                if (!confirm(`确认删除展会「${ev.name}」？`)) return;
                eventMut.remove.mutate(ev.id, { onSuccess: () => setEventModal((s) => ({ ...s, open: false })) });
              }
        }
      />

      {/* 信息源 新增/编辑 */}
      <SimpleEditModal<ISource>
        title={sourceModal.isCreate ? '新增信息源' : `编辑信息源：${sourceModal.data.name || ''}`}
        fields={buildSourceFields(events)}
        initial={sourceModal.data}
        isCreate={sourceModal.isCreate}
        open={sourceModal.open}
        onOpenChange={(o) => setSourceModal((s) => ({ ...s, open: o }))}
        saving={sourceMut.create.isPending || sourceMut.update.isPending}
        onSave={(data) => {
          if (sourceModal.isCreate) {
            sourceMut.create.mutate(data, { onSuccess: () => setSourceModal((s) => ({ ...s, open: false })) });
          } else {
            sourceMut.update.mutate(
              { id: (sourceModal.data as ISource).id, data },
              { onSuccess: () => setSourceModal((s) => ({ ...s, open: false })) },
            );
          }
        }}
        onDelete={
          sourceModal.isCreate
            ? undefined
            : () => {
                const s = sourceModal.data as ISource;
                if (!confirm(`确认删除信息源「${s.name}」？`)) return;
                sourceMut.remove.mutate(s.id, { onSuccess: () => setSourceModal((st) => ({ ...st, open: false })) });
              }
        }
      />
    </div>
  );
}
