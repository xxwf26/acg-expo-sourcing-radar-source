import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/api/ai';

/** 单对象 AI 总结（按需触发，非缓存查询） */
export function useEntitySummary() {
  return useMutation({
    mutationFn: (id: string) => aiApi.summaryEntity(id),
  });
}
