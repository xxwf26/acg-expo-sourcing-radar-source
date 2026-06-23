import axiosForBackend from './index';
import type { ISource, IListResponse } from './types';

export const sourceApi = {
  getList: async (): Promise<IListResponse<ISource>> => {
    const res = await axiosForBackend({ url: '/api/sources', method: 'GET' });
    return res.data;
  },
};
