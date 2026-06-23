import { useQuery } from '@tanstack/react-query';
import { eventApi } from '@/api/event';
import { entityApi } from '@/api/entity';
import { sourceApi } from '@/api/source';

// 全量拉取，过滤在前端内存里做（数据量小，交互快）
export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: () => eventApi.getList(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntities() {
  return useQuery({
    queryKey: ['entities'],
    // 拉全量（含 excluded），前端按需过滤
    queryFn: () => entityApi.getList({ includeExcluded: true }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: () => sourceApi.getList(),
    staleTime: 5 * 60 * 1000,
  });
}
