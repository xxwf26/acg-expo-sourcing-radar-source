import axiosForBackend from './index';

export interface IAiSummaryResult {
  scenario: string;
  targetId: string;
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
};
