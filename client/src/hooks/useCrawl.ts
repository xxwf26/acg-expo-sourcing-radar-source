import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { crawlApi } from '@/api/crawl';
import type { ICrawlRun, IPromotePayload } from '@/api/types';

function errMsg(e: any, fallback: string): string {
  return e?.response?.data?.message || fallback;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 触发抓取后轮询 run 状态直到结束（后台抓取长名单可能几分钟） */
async function runAndWait(sourceId: string): Promise<ICrawlRun> {
  const { runId } = await crawlApi.run(sourceId);
  // 最多轮询 ~12 分钟（4s × 180）
  for (let i = 0; i < 180; i++) {
    await sleep(4000);
    const run = await crawlApi.getRun(runId);
    if (run.status !== 'running') return run;
  }
  throw new Error('抓取超时（后台仍可能在继续，稍后刷新候选查看）');
}

/** 候选列表（按状态） */
export function useCandidates(status = 'pending') {
  return useQuery({
    queryKey: ['candidates', status],
    queryFn: () => crawlApi.getCandidates(status),
    staleTime: 30 * 1000,
  });
}

/** 候选状态计数 */
export function useCandidateCounts() {
  return useQuery({
    queryKey: ['candidate-counts'],
    queryFn: () => crawlApi.getCounts(),
    staleTime: 30 * 1000,
  });
}

/** 近期抓取批次历史。有进行中批次时自动轮询刷新。 */
export function useCrawlRuns() {
  return useQuery({
    queryKey: ['crawl-runs'],
    queryFn: () => crawlApi.getRuns(),
    staleTime: 10 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.list || []).some((r) => r.status === 'running') ? 5000 : false,
  });
}

/** 抓取 + 复核动作 mutations */
export function useCrawlMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['candidates'] });
    qc.invalidateQueries({ queryKey: ['candidate-counts'] });
    qc.invalidateQueries({ queryKey: ['crawl-runs'] });
    qc.invalidateQueries({ queryKey: ['sources'] });
  };

  const run = useMutation({
    mutationFn: (sourceId: string) => runAndWait(sourceId),
    onSuccess: (run) => {
      invalidate();
      if (run.status === 'ok') {
        const n = run.extractedCount ?? 0;
        const partial = run.error ? `（${run.error}）` : '';
        toast.success(`抓取完成：新增 ${n} 个候选${partial}`);
      } else {
        toast.error(`抓取失败：${run.error || '未知错误'}`);
      }
    },
    onError: (e) => toast.error(errMsg(e, '抓取失败')),
  });

  const runAll = useMutation({
    mutationFn: async () => {
      const { runIds } = await crawlApi.runAll();
      // 等所有 run 结束
      await Promise.all(
        runIds.map(async (id) => {
          for (let i = 0; i < 180; i++) {
            await sleep(4000);
            const r = await crawlApi.getRun(id);
            if (r.status !== 'running') return r;
          }
        }),
      );
      return { ran: runIds.length };
    },
    onSuccess: (res) => {
      invalidate();
      toast.success(`已完成 ${res.ran} 个信息源的抓取`);
    },
    onError: (e) => toast.error(errMsg(e, '批量抓取失败')),
  });

  const promote = useMutation({
    mutationFn: ({ id, data }: { id: string; data: IPromotePayload }) => crawlApi.promote(id, data),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['entities'] });
      toast.success('已转正为建联对象');
    },
    onError: (e) => toast.error(errMsg(e, '转正失败')),
  });

  const merge = useMutation({
    mutationFn: ({ id, targetEntityId }: { id: string; targetEntityId: string }) => crawlApi.merge(id, targetEntityId),
    onSuccess: () => {
      invalidate();
      toast.success('已合并到已有对象');
    },
    onError: (e) => toast.error(errMsg(e, '合并失败')),
  });

  const reject = useMutation({
    mutationFn: (id: string) => crawlApi.reject(id),
    onSuccess: () => {
      invalidate();
      toast.success('已丢弃候选');
    },
    onError: (e) => toast.error(errMsg(e, '丢弃失败')),
  });

  return { run, runAll, promote, merge, reject };
}
