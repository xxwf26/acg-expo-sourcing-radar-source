import { useMutation } from '@tanstack/react-query';
import { aiApi, type IAiChatMessage } from '@/api/ai';

/** 单对象 AI 总结（按需触发，非缓存查询） */
export function useEntitySummary() {
  return useMutation({
    mutationFn: (id: string) => aiApi.summaryEntity(id),
  });
}

/** 全局聊天助手（多轮，组件本地维护历史） */
export function useAiChat() {
  return useMutation({
    mutationFn: (params: { message: string; history: IAiChatMessage[] }) =>
      aiApi.chat(params.message, params.history),
  });
}

/** 本周建议动作（AI 动态生成，按三类标注） */
export function useWeeklyActions() {
  return useMutation({
    mutationFn: () => aiApi.weeklyActions(),
  });
}
