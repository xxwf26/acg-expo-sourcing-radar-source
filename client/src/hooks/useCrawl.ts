import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { crawlApi } from '@/api/crawl';
import type { IPromotePayload, ISourcingConfig } from '@/api/types';

function errMsg(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
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

/** 近期抓取批次历史。有进行中批次时自动轮询刷新（唯一的进度轮询来源）。 */
export function useCrawlRuns() {
  return useQuery({
    queryKey: ['crawl-runs'],
    queryFn: () => crawlApi.getRuns(),
    staleTime: 10 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.list || []).some((r) => r.status === 'running') ? 5000 : false,
  });
}

/**
 * 全局抓取完成通知：监听 runs 列表，run 从 running → ok/failed 时弹 toast。
 * 首次见到的 run 只记录不弹（避免页面加载时对历史 run 刷屏）。
 * 在常驻的 RadarDashboardPage 调用一次即可全局生效。
 */
export function useCrawlRunNotifications() {
  const { data } = useCrawlRuns();
  const seen = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const list = data?.list || [];
    for (const r of list) {
      const prev = seen.current.get(r.id);
      if (prev === undefined) {
        seen.current.set(r.id, r.status);
        continue;
      }
      if (prev === 'running' && r.status !== 'running') {
        if (r.status === 'ok') {
          const n = r.extractedCount ?? 0;
          const partial = r.error ? `（${r.error}）` : '';
          toast.success(`抓取完成：新增 ${n} 个候选${partial}`);
        } else {
          toast.error(`抓取失败：${r.error || '未知错误'}`);
        }
      }
      seen.current.set(r.id, r.status);
    }
  }, [data]);
}

/** 采购匹配配置 */
export function useSourcingConfig() {
  return useQuery({
    queryKey: ['sourcing-config'],
    queryFn: () => crawlApi.getConfig(),
    staleTime: 5 * 60 * 1000,
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

  // 抓取触发即返回（后台异步），进度与完成通知由 useCrawlRuns + useCrawlRunNotifications 负责，
  // 不再用阻塞式 runAndWait（避免 12 分钟不可取消的 mutation + 双重轮询）。
  const run = useMutation({
    mutationFn: (sourceId: string) => crawlApi.run(sourceId),
    onSuccess: () => toast.success('抓取已开始，进度见「抓取历史」'),
    onError: (e) => toast.error(errMsg(e, '抓取触发失败')),
  });

  const runAll = useMutation({
    mutationFn: async () => crawlApi.runAll(),
    onSuccess: (res) => toast.success(`已触发 ${res.ran} 个源的抓取，进度见「抓取历史」`),
    onError: (e) => toast.error(errMsg(e, '批量抓取触发失败')),
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

  const restore = useMutation({
    mutationFn: (id: string) => crawlApi.restore(id),
    onSuccess: () => {
      invalidate();
      toast.success('已恢复到待复核');
    },
    onError: (e) => toast.error(errMsg(e, '恢复失败')),
  });

  const saveConfig = useMutation({
    mutationFn: (data: Partial<ISourcingConfig>) => crawlApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sourcing-config'] });
      toast.success('采购配置已保存');
    },
    onError: (e) => toast.error(errMsg(e, '保存失败')),
  });

  const score = useMutation({
    mutationFn: (scope: 'pending-unscored' | 'all-pending') => crawlApi.score(scope),
    onSuccess: (res) => {
      invalidate();
      toast.success(`AI 打分完成：${res.scored}/${res.total} 个候选`);
    },
    onError: (e) => toast.error(errMsg(e, 'AI 打分失败')),
  });

  const batch = useMutation({
    mutationFn: (body: { action: 'promote' | 'reject'; ids?: string[]; minScore?: number; maxScore?: number }) =>
      crawlApi.batch(body),
    onSuccess: (res) => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['entities'] });
      const verb = res.action === 'promote' ? '转正' : '丢弃';
      toast.success(`批量${verb}完成：${res.affected} 个候选`);
    },
    onError: (e) => toast.error(errMsg(e, '批量操作失败')),
  });

  return { run, runAll, promote, merge, reject, restore, saveConfig, score, batch };
}
