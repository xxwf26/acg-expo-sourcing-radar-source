import { useCrawlRuns } from '@/hooks/useCrawl';
import { cn } from '@/lib/utils';
import { Loader2, CheckCircle2, XCircle, History } from 'lucide-react';
import type { ICrawlRunListItem } from '@/api/types';

function StatusIcon({ status }: { status: ICrawlRunListItem['status'] }) {
  if (status === 'running') return <Loader2 className="size-3.5 animate-spin text-primary" />;
  if (status === 'ok') return <CheckCircle2 className="size-3.5 text-success" />;
  return <XCircle className="size-3.5 text-destructive" />;
}

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return ts;
  }
}

/**
 * 抓取历史/进度面板：展示近期各信息源的抓取批次（成功/失败/进行中 + 抽取数）。
 * 有 running 批次时自动轮询刷新，让多源抓取进度可见。
 */
export default function CrawlHistoryPanel() {
  const { data, isLoading } = useCrawlRuns();
  const runs = data?.list || [];

  if (isLoading || runs.length === 0) return null;

  return (
    <details className="rounded-xl border bg-card p-3 shadow-sm">
      <summary className="flex cursor-pointer select-none items-center gap-1.5 text-sm font-semibold">
        <History className="size-4" />
        抓取历史
        <span className="text-xs font-normal text-muted-foreground">（近 {runs.length} 次）</span>
      </summary>
      <div className="mt-2 space-y-1">
        {runs.map((r) => (
          <div key={r.id} className="rounded-md px-2 py-1 text-xs hover:bg-muted/40">
            <div className="flex items-center gap-2">
              <StatusIcon status={r.status} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.sourceName}</span>
              <span className="shrink-0 text-muted-foreground">
                {r.status === 'running'
                  ? '抓取中…'
                  : r.status === 'ok'
                    ? `+${r.extractedCount ?? 0} 候选`
                    : '失败'}
              </span>
              <span className="shrink-0 text-muted-foreground/70">{fmt(r.startedAt)}</span>
            </div>
            {r.error && (
              <p
                className={cn(
                  'mt-0.5 pl-5 text-[11px] leading-relaxed',
                  r.status === 'failed' ? 'text-destructive' : 'text-muted-foreground/80',
                )}
              >
                {r.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
