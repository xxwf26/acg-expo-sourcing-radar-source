import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { engagementApi } from '@/api/engagement';
import type { IEngagement, IListResponse } from '@/api/types';

const KEY = ['engagements'];

// 一次拉回全部建联记录，组件内按 entityId 查映射
export function useEngagements() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => engagementApi.getAll(),
    staleTime: 60 * 1000,
  });
}

// upsert 建联状态，乐观更新到 ['engagements'] 缓存
export function useUpsertEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entityId,
      data,
    }: {
      entityId: string;
      data: Partial<Pick<IEngagement, 'status' | 'owner' | 'note' | 'updatedBy'>>;
    }) => engagementApi.upsert(entityId, data),
    onMutate: async ({ entityId, data }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<IListResponse<IEngagement>>(KEY);
      qc.setQueryData<IListResponse<IEngagement>>(KEY, (old) => {
        const list = old?.list ? [...old.list] : [];
        const idx = list.findIndex((e) => e.entityId === entityId);
        const merged: IEngagement = {
          entityId,
          status: '待评估',
          owner: null,
          note: null,
          updatedBy: null,
          ...(idx >= 0 ? list[idx] : {}),
          ...data,
        };
        if (idx >= 0) list[idx] = merged;
        else list.push(merged);
        return { list, total: list.length };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
