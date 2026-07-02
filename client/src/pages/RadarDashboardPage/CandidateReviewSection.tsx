import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TYPE_LABELS, TYPE_OPTIONS } from '@/lib/filterConfig';
import { useCandidates, useCandidateCounts, useCrawlMutations } from '@/hooks/useCrawl';
import type { ICandidate, IEntity, IPromotePayload, Priority, EntityType } from '@/api/types';
import { MapPin, Check, Trash2, GitMerge, RefreshCw, Sparkles, Clock, RotateCcw, Settings2, ExternalLink } from 'lucide-react';
import CrawlHistoryPanel from '@/components/CrawlHistoryPanel';
import SourcingConfigModal from '@/components/SourcingConfigModal';

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'pending', label: '待复核' },
  { key: 'promoted', label: '已转正' },
  { key: 'merged', label: '已合并' },
  { key: 'rejected', label: '已丢弃' },
];

/** 转正前的快速编辑弹窗：复核人确认/修正字段后转正 */
function PromoteDialog({
  candidate,
  open,
  onOpenChange,
  onConfirm,
  saving,
}: {
  candidate: ICandidate | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (data: IPromotePayload) => void;
  saving: boolean;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<EntityType>('creatorKol');
  const [priority, setPriority] = useState<Priority>('B');
  const [score, setScore] = useState(60);
  const [region, setRegion] = useState('');
  const [booth, setBooth] = useState('');

  // 打开时用候选值初始化表单；分数/优先级尽量沿用 AI 打分结果
  useEffect(() => {
    if (open && candidate) {
      const s = candidate.aiScore ?? 60;
      setName(candidate.name);
      setType(candidate.type);
      setPriority(s >= 90 ? 'S' : s >= 70 ? 'A' : 'B');
      setScore(s);
      setRegion(candidate.region || '');
      setBooth(candidate.booth || '');
    }
  }, [open, candidate]);

  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">转正为建联对象</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            确认或修正以下字段后转正。转正后会作为正式建联对象进入对象库，可再编辑。
          </p>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">名称 *</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">类型</p>
              <Select value={type} onValueChange={(v) => setType(v as EntityType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">优先级</p>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['S', 'A', 'B'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">匹配分</p>
              <Input type="number" min={0} max={100} value={score} onChange={(e) => { const n = Number(e.target.value); setScore(Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n))); }} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">展位</p>
              <Input value={booth} onChange={(e) => setBooth(e.target.value)} placeholder="如 A-12" />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">地区</p>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="如 北美 / 日本" />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button
              size="sm"
              disabled={saving || !name.trim()}
              onClick={() => onConfirm({ name: name.trim(), type, priority, score, region, booth })}
            >
              {saving ? '转正中…' : '确认转正'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 合并到已有对象的选择弹窗 */
function MergeDialog({
  candidate,
  entities,
  open,
  onOpenChange,
  onConfirm,
  saving,
}: {
  candidate: ICandidate | null;
  entities: IEntity[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (targetId: string) => void;
  saving: boolean;
}) {
  const [target, setTarget] = useState('');
  // 优先把疑似重复对象排在最前（useMemo 避免每次渲染重排；须在 early return 之前调 hook）
  const suggested = candidate?.dedupEntityId;
  const sorted = useMemo(
    () => [...entities].sort((a, b) => (a.id === suggested ? -1 : b.id === suggested ? 1 : 0)),
    [entities, suggested],
  );
  if (!candidate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">合并到已有对象</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            把候选「{candidate.name}」标记为已合并到选定的已有对象（不覆盖已有对象数据）。
          </p>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue placeholder="选择目标对象" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {sorted.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.id === suggested ? '⭐ ' : ''}{e.name}（{TYPE_LABELS[e.type]}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" disabled={saving || !target} onClick={() => onConfirm(target)}>
              {saving ? '合并中…' : '确认合并'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CandidateCard({
  c,
  canEdit,
  dupName,
  busy,
  onPromote,
  onMerge,
  onReject,
  onRestore,
}: {
  c: ICandidate;
  canEdit: boolean;
  dupName?: string;
  busy?: boolean;
  onPromote: () => void;
  onMerge: () => void;
  onReject: () => void;
  onRestore: () => void;
}) {
  const isPending = c.status === 'pending';
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold">{c.name}</h3>
            <Badge variant="secondary" className="font-normal">{TYPE_LABELS[c.type]}</Badge>
            {c.aiScore != null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold',
                  c.aiScore >= 90 ? 'bg-primary/15 text-primary' : c.aiScore >= 70 ? 'bg-teal-100 text-teal-700' : c.aiScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground',
                )}
                title="AI 匹配分"
              >
                <Sparkles className="size-3" />{c.aiScore}
              </span>
            )}
            {c.dedupEntityId && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
                疑似已有{dupName ? `：${dupName}` : ''}
              </Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {c.booth && (
              <span className="flex items-center gap-1"><MapPin className="size-3" />{c.booth}</span>
            )}
            {c.activityTime && (
              <span className="flex items-center gap-1"><Clock className="size-3" />{c.activityTime}</span>
            )}
            {c.region && <span>{c.region}</span>}
            {c.followerScale && <span>粉丝：{c.followerScale}</span>}
          </div>
        </div>
        {!isPending && (
          <Badge
            variant="outline"
            className={cn(
              c.status === 'promoted' && 'border-green-300 bg-green-50 text-green-700',
              c.status === 'merged' && 'border-blue-300 bg-blue-50 text-blue-700',
              c.status === 'rejected' && 'border-muted bg-muted text-muted-foreground',
            )}
          >
            {c.status === 'promoted' ? '已转正' : c.status === 'merged' ? '已合并' : '已丢弃'}
          </Badge>
        )}
      </div>

      {c.aiReason && (
        <p className="mt-2 flex gap-1 text-xs leading-relaxed text-primary/90">
          <Sparkles className="mt-0.5 size-3 shrink-0" />
          <span>{c.aiReason}</span>
        </p>
      )}

      {c.reason && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.reason}</p>}

      {c.links && c.links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {c.links.map(([label, url], i) => (
            <a
              key={`${url}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
            >
              {label || '作品主页'}
              <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}

      {c.rawSnippet && (
        <div className="mt-2 rounded-md bg-muted/50 px-2.5 py-1.5">
          <p className="text-[10px] font-medium text-muted-foreground/70">来源原文</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{c.rawSnippet}</p>
        </div>
      )}

      {isPending && canEdit && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          <Button size="sm" onClick={onPromote} disabled={busy}>
            <Check className="size-4" />
            转正
          </Button>
          <Button variant="outline" size="sm" onClick={onMerge} disabled={busy}>
            <GitMerge className="size-4" />
            合并到已有
          </Button>
          <Button variant="outline" size="sm" onClick={onReject} disabled={busy} className="text-destructive hover:bg-destructive/5">
            <Trash2 className="size-4" />
            丢弃
          </Button>
        </div>
      )}

      {/* 已丢弃/已合并可一键恢复到待复核（软删除的反操作，防误操作） */}
      {!isPending && canEdit && c.status !== 'promoted' && (
        <div className="mt-3 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onRestore} disabled={busy}>
            <RotateCcw className="size-4" />
            恢复到待复核
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CandidateReviewSection({
  canEdit,
  entities,
}: {
  canEdit: boolean;
  entities: IEntity[];
}) {
  const [status, setStatus] = useState('pending');
  const candidatesQuery = useCandidates(status);
  const countsQuery = useCandidateCounts();
  const { promote, merge, reject, restore, score, batch } = useCrawlMutations();

  const [promoteTarget, setPromoteTarget] = useState<ICandidate | null>(null);
  const [mergeTarget, setMergeTarget] = useState<ICandidate | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const counts = countsQuery.data;
  const list = candidatesQuery.data?.list || [];
  const entityName = (id: string | null) => entities.find((e) => e.id === id)?.name;
  // 批量阈值命中数（仅当前 pending 列表）
  const highScoreCount = list.filter((c) => c.aiScore != null && c.aiScore >= 85).length;
  const lowScoreCount = list.filter((c) => c.aiScore != null && c.aiScore < 50).length;

  return (
    <div className="space-y-4">
      <CrawlHistoryPanel />

      {/* 状态分段 + 计数 */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => {
          const n = counts ? (counts as any)[t.key] : undefined;
          const active = status === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50',
              )}
            >
              {t.label}
              {n != null && <span className={cn('ml-1.5', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{n}</span>}
            </button>
          );
        })}
      </div>

      {status === 'pending' && (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted-foreground">
            候选由系统从信息源自动抓取 + AI 抽取而来，<b>未经人工确认不会进入正式对象库</b>。逐条转正 / 合并到已有 / 丢弃。
          </p>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
                <Settings2 className="size-4" />
                采购配置
              </Button>
              <Button
                size="sm"
                onClick={() => score.mutate('pending-unscored')}
                disabled={score.isPending}
              >
                <Sparkles className={cn('size-4', score.isPending && 'animate-pulse')} />
                {score.isPending ? 'AI 打分中…' : 'AI 打分'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => score.mutate('all-pending')}
                disabled={score.isPending}
                className="text-xs text-muted-foreground"
                title="忽略已有分数，对所有待复核重新打分（改了采购配置后用）"
              >
                重新打分全部
              </Button>

              {/* 批量操作：按分数阈值。显示命中数，避免误操作 */}
              <span className="mx-1 h-4 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                disabled={batch.isPending || highScoreCount === 0}
                onClick={() => {
                  if (confirm(`确认批量转正 ${highScoreCount} 个匹配分 ≥85 的候选？`))
                    batch.mutate({ action: 'promote', minScore: 85 });
                }}
                className="text-primary"
              >
                <Check className="size-4" />
                批量转正 ≥85（{highScoreCount}）
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={batch.isPending || lowScoreCount === 0}
                onClick={() => {
                  if (confirm(`确认批量丢弃 ${lowScoreCount} 个匹配分 <50 的候选？（可在“已丢弃”里恢复）`))
                    batch.mutate({ action: 'reject', maxScore: 49 });
                }}
                className="text-destructive hover:bg-destructive/5"
              >
                <Trash2 className="size-4" />
                批量丢弃 &lt;50（{lowScoreCount}）
              </Button>
            </div>
          )}
        </div>
      )}

      {candidatesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          {status === 'pending'
            ? '暂无待复核候选。去「信息源监控」配置抓取 URL 并点「立即抓取」，抓回的对象会出现在这里。'
            : '该状态下暂无候选。'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              canEdit={canEdit}
              dupName={entityName(c.dedupEntityId)}
              busy={reject.isPending || restore.isPending || promote.isPending || merge.isPending || score.isPending || batch.isPending}
              onPromote={() => setPromoteTarget(c)}
              onMerge={() => setMergeTarget(c)}
              onReject={() => {
                if (confirm(`确认丢弃候选「${c.name}」？`)) reject.mutate(c.id);
              }}
              onRestore={() => restore.mutate(c.id)}
            />
          ))}
        </div>
      )}

      <PromoteDialog
        candidate={promoteTarget}
        open={!!promoteTarget}
        onOpenChange={(o) => !o && setPromoteTarget(null)}
        saving={promote.isPending}
        onConfirm={(data) => {
          if (!promoteTarget) return;
          promote.mutate({ id: promoteTarget.id, data }, { onSuccess: () => setPromoteTarget(null) });
        }}
      />
      <MergeDialog
        candidate={mergeTarget}
        entities={entities}
        open={!!mergeTarget}
        onOpenChange={(o) => !o && setMergeTarget(null)}
        saving={merge.isPending}
        onConfirm={(targetEntityId) => {
          if (!mergeTarget) return;
          merge.mutate({ id: mergeTarget.id, targetEntityId }, { onSuccess: () => setMergeTarget(null) });
        }}
      />
      <SourcingConfigModal open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}
