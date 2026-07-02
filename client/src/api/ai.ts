import axiosForBackend from './index';

export interface IAiSummaryResult {
  scenario: string;
  targetId: string;
  model: string;
  content: string;
  usage: Record<string, number>;
}

export interface IAiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface IAiChatResult {
  scenario: string;
  model: string;
  content: string;
  usage: Record<string, number>;
}

export const aiApi = {
  /** 单对象采购总结 + 建议 */
  summaryEntity: async (id: string): Promise<IAiSummaryResult> => {
    const res = await axiosForBackend({ url: `/api/ai/summary/entity/${id}`, method: 'POST' });
    return res.data;
  },

  /** 全局聊天助手（带全库快照，可多轮） */
  chat: async (message: string, history: IAiChatMessage[]): Promise<IAiChatResult> => {
    const res = await axiosForBackend({
      url: '/api/ai/chat',
      method: 'POST',
      data: { message, history },
    });
    return res.data;
  },
};

