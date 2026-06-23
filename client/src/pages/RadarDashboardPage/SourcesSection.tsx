import { ExternalLink } from 'lucide-react';
import type { ISource } from '@/api/types';

const WORKFLOW_NOTES = [
  '每日/每周抓取官方 Exhibitor、Artist Alley、Guest、Schedule 页面。',
  '新增对象进入“待人工确认”，AI 只做推荐，不直接改采购结论。',
  '建联状态与备注写回数据库，多人协作可见。',
  '展会前 30 天提高频率，展会后一周生成复盘报告。',
];

export default function SourcesSection({ sources }: { sources: ISource[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{source.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">监控频率：{source.cadence}</p>
            <p className="text-xs text-muted-foreground">字段：{source.fields}</p>
            {source.links && source.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
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
      <aside className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="text-sm font-semibold">后续自动更新方式</h3>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-muted-foreground">
          {WORKFLOW_NOTES.map((n) => (
            <li key={n} className="flex gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
