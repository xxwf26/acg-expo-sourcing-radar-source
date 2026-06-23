import axiosForBackend from './index';
import type { IEvent, IListResponse } from './types';

export const eventApi = {
  getList: async (): Promise<IListResponse<IEvent>> => {
    const res = await axiosForBackend({ url: '/api/events', method: 'GET' });
    return res.data;
  },
  create: async (data: Partial<IEvent>): Promise<IEvent> => {
    const res = await axiosForBackend({ url: '/api/events', method: 'POST', data });
    return res.data;
  },
  update: async (id: string, data: Partial<IEvent>): Promise<IEvent> => {
    const res = await axiosForBackend({ url: `/api/events/${id}`, method: 'PUT', data });
    return res.data;
  },
  remove: async (id: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({ url: `/api/events/${id}`, method: 'DELETE' });
    return res.data;
  },
};
