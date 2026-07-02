import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ENGAGEMENT_STATUS_OPTIONS } from '@/lib/filterConfig';
import { ENGAGEMENT_STATUS_STYLE } from '@/lib/badgeStyles';
import { TYPE_LABELS } from '@/lib/filterConfig';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import type { IEntity, IEngagement, IEvent } from '@/api/types';

/** CSV 字段转义：含逗号/引号/换行则包引号并转义内部引号 */
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * 建联进度看板 + 导出（纯前端，用已加载的 entities + engagements 派生）。
 * - 按建联状态分组统计
 * - 一键导出 CSV（对象 + 建联状态/负责人/备注 + 链接），给业务方/周报用
 */
export default function EngagementBoardSection({
  entities,
  engagementMap,
  events,
}: {
  entities: IEntity[];
  engagementMap: Map<string, IEngagement>;
  events: IEvent[];
}) {
  const visible = useMemo(() => entities.filter((e) => !e.excluded), [entities]);
  const eventShort = (id: string) => events.find((e) => e.id === id)?.short || id;

  // 状态分布（按固定状态顺序，未维护的算「待评估」）
  const statusCounts = useMemo(() => {
    const m = new Map<string, number>();
    ENGAGEMENT_STATUS_OPTIONS.forEach((s) => m.set(s, 0));
    for (const e of visible) {
      const st = engagementMap.get(e.id)?.status || '待评估';
      m.set(st, (m.get(st) || 0) + 1);
    }
    return m;
  }, [visible, engagementMap]);

  const withOwner = useMemo(
    () => visible.filter((e) => engagementMap.get(e.id)?.owner).length,
    [visible, engagementMap],
  );

  const exportCsv = () => {
    const headers = ['名称', '类型', '优先级', '匹配分', '地区', '展位', '关联展会', '建联状态', '负责人', '备注', '链接'];
    const rows = visible
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((e) => {
        const eng = engagementMap.get(e.id);
        const links = (e.links || []).map(([, url]) => url).join(' | ');
        const evs = (e.events || []).map(eventShort).join(' / ');
        return [
          e.name,
          TYPE_LABELS[e.type] || e.type,
          e.priority,
          e.score,
          e.region || '',
          e.booth || '',
          evs,
          eng?.status || '待评估',
          eng?.owner || '',
          eng?.note || '',
          links,
        ].map(csvCell).join(',');
      });
    // 加 BOM 让 Excel 正确识别 UTF-8 中文
    const csv = '﻿' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `建联对象导出_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${visible.length} 条建联对象`);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          共 {visible.length} 个建联对象，其中 {withOwner} 个已分配负责人。按建联状态查看进度，可导出给业务方或周报。
        </p>
        <Button size="sm" onClick={exportCsv} disabled={visible.length === 0}>
          <Download className="size-4" />
          导出 CSV
        </Button>
      </div>

      {/* 状态分布卡片 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ENGAGEMENT_STATUS_OPTIONS.map((st) => {
          const n = statusCounts.get(st) || 0;
          const pct = visible.length ? Math.round((n / visible.length) * 100) : 0;
          return (
            <div key={st} className="rounded-xl border bg-card p-4 shadow-sm">
              <div
                className={cn(
                  'inline-flex rounded border px-2 py-0.5 text-xs font-medium',
                  ENGAGEMENT_STATUS_STYLE[st] || ENGAGEMENT_STATUS_STYLE['待评估'],
                )}
              >
                {st}
              </div>
              <div className="mt-2 text-2xl font-extrabold">{n}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{pct}%</div>
            </div>
          );
        })}
      </div>

      {/* 简易堆叠进度条 */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold">建联漏斗</p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          {ENGAGEMENT_STATUS_OPTIONS.map((st, i) => {
            const n = statusCounts.get(st) || 0;
            const pct = visible.length ? (n / visible.length) * 100 : 0;
            if (pct === 0) return null;
            const colors = ['bg-slate-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-500', 'bg-zinc-300'];
            return <div key={st} className={cn(colors[i % colors.length])} style={{ width: `${pct}%` }} title={`${st}: ${n}`} />;
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {ENGAGEMENT_STATUS_OPTIONS.map((st, i) => {
            const colors = ['bg-slate-400', 'bg-blue-400', 'bg-amber-400', 'bg-emerald-500', 'bg-zinc-300'];
            return (
              <span key={st} className="inline-flex items-center gap-1">
                <span className={cn('inline-block size-2 rounded-full', colors[i % colors.length])} />
                {st}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
