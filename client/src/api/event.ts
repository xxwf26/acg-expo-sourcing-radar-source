import axiosForBackend from './index';
import type { IEvent, IListResponse } from './types';

export const eventApi = {
  getList: async (): Promise<IListResponse<IEvent>> => {
    const res = await axiosForBackend({ url: '/api/events', method: 'GET' });
    return res.data;
  },
};
