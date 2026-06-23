import axiosForBackend from './index';
import type { IEngagement, IListResponse } from './types';

export const engagementApi = {
  getAll: async (): Promise<IListResponse<IEngagement>> => {
    const res = await axiosForBackend({ url: '/api/engagements', method: 'GET' });
    return res.data;
  },
  upsert: async (
    entityId: string,
    data: Partial<Pick<IEngagement, 'status' | 'owner' | 'note' | 'updatedBy'>>,
  ): Promise<IEngagement> => {
    const res = await axiosForBackend({
      url: `/api/engagements/${entityId}`,
      method: 'PUT',
      data,
    });
    return res.data;
  },
};
