import axiosForBackend from './index';
import type { ISource, IListResponse } from './types';

export const sourceApi = {
  getList: async (): Promise<IListResponse<ISource>> => {
    const res = await axiosForBackend({ url: '/api/sources', method: 'GET' });
    return res.data;
  },
  create: async (data: Partial<ISource>): Promise<ISource> => {
    const res = await axiosForBackend({ url: '/api/sources', method: 'POST', data });
    return res.data;
  },
  update: async (id: string, data: Partial<ISource>): Promise<ISource> => {
    const res = await axiosForBackend({ url: `/api/sources/${id}`, method: 'PUT', data });
    return res.data;
  },
  remove: async (id: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({ url: `/api/sources/${id}`, method: 'DELETE' });
    return res.data;
  },
};
