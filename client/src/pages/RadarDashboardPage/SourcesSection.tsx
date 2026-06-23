import { ExternalLink, Plus, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ISource } from '@/api/types';

const WORKFLOW_NOTES = [
  '每日/每周抓取官方 Exhibitor、Artist Alley、Guest、Schedule 页面。',
  '新增对象进入"待人工确认"，AI 只做推荐，不直接改采购结论。',
  '建联状态与备注写回数据库，多人协作可见。',
  '展会前 30 天提高频率，展会后一周生成复盘报告。',
];

const INTERNAL_TABLES = [
  '展会主表：日期、城市、官方链接、名单状态、负责采购。',
  '对象主表：名称、类型、平台链接、标签、推荐理由、优先级。',
  '建联记录：联系人、沟通状态、报价、风险、后续动作。',
  '业务收藏：业务方想联系谁、原因、项目/IP、期望窗口。',
];

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold">{title}</h3>
      <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
        {items.map((n) => (
          <li key={n} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SourcesSection({
  sources,
  canEdit = false,
  onCreate,
  onEdit,
}: {
  sources: ISource[];
  canEdit?: boolean;
  onCreate?: () => void;
  onEdit?: (source: ISource) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={onCreate}>
              <Plus className="size-4" />
              新增信息源
            </Button>
          </div>
        )}
        {sources.map((source) => (
          <div key={source.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-bold">{source.name}</h3>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => onEdit?.(source)} className="shrink-0">
                  <Pencil className="size-4" />
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">监控频率：{source.cadence}</p>
            <p className="text-xs text-muted-foreground">字段：{source.fields}</p>
            {source.links && source.links.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {source.links.map(([label, url]) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
                  >
                    {label}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <aside className="space-y-4">
        <Panel title="后续自动更新方式" items={WORKFLOW_NOTES} />
        <Panel title="适合接入的内部表" items={INTERNAL_TABLES} />
      </aside>
    </div>
  );
}

