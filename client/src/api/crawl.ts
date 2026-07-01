import axiosForBackend from './index';
import type {
  ICandidate,
  ICandidateCounts,
  ICrawlRun,
  ICrawlRunListItem,
  ICrawlRunResult,
  IListResponse,
  IPromotePayload,
} from './types';

export const crawlApi = {
  /** 触发单源抓取（admin）——异步，立即返回 runId */
  run: async (sourceId: string): Promise<ICrawlRunResult> => {
    const res = await axiosForBackend({ url: `/api/crawl/run/${sourceId}`, method: 'POST' });
    return res.data;
  },
  /** 触发全部启用源（admin）——各自异步 */
  runAll: async (): Promise<{ ran: number; runIds: string[] }> => {
    const res = await axiosForBackend({ url: '/api/crawl/run-all', method: 'POST' });
    return res.data;
  },
  /** 查抓取批次状态（轮询用） */
  getRun: async (runId: string): Promise<ICrawlRun> => {
    const res = await axiosForBackend({ url: `/api/crawl/run/${runId}`, method: 'GET' });
    return res.data;
  },
  /** 近期抓取批次历史 */
  getRuns: async (): Promise<IListResponse<ICrawlRunListItem>> => {
    const res = await axiosForBackend({ url: '/api/crawl/runs', method: 'GET' });
    return res.data;
  },
  /** 候选列表 */
  getCandidates: async (status = 'pending'): Promise<IListResponse<ICandidate>> => {
    const res = await axiosForBackend({ url: `/api/candidates?status=${status}`, method: 'GET' });
    return res.data;
  },
  /** 各状态计数 */
  getCounts: async (): Promise<ICandidateCounts> => {
    const res = await axiosForBackend({ url: '/api/candidates/counts', method: 'GET' });
    return res.data;
  },
  /** 转正为正式建联对象（admin） */
  promote: async (id: string, data: IPromotePayload): Promise<{ entityId: string; status: string }> => {
    const res = await axiosForBackend({ url: `/api/candidates/${id}/promote`, method: 'POST', data });
    return res.data;
  },
  /** 合并到已有对象（admin） */
  merge: async (id: string, targetEntityId: string): Promise<{ mergedInto: string; status: string }> => {
    const res = await axiosForBackend({ url: `/api/candidates/${id}/merge`, method: 'POST', data: { targetEntityId } });
    return res.data;
  },
  /** 丢弃（admin） */
  reject: async (id: string): Promise<{ status: string }> => {
    const res = await axiosForBackend({ url: `/api/candidates/${id}/reject`, method: 'POST' });
    return res.data;
  },
};
