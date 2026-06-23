import axiosForBackend from './index';
import type { IEntity, IEntityFilter, IListResponse } from './types';

export const entityApi = {
  getList: async (filter?: IEntityFilter): Promise<IListResponse<IEntity>> => {
    const params = new URLSearchParams();
    if (filter?.type?.length) params.append('type', filter.type.join(','));
    if (filter?.priority?.length) params.append('priority', filter.priority.join(','));
    if (filter?.event) params.append('event', filter.event);
    if (filter?.angle) params.append('angle', filter.angle);
    if (filter?.keyword) params.append('keyword', filter.keyword);
    if (filter?.includeExcluded) params.append('includeExcluded', 'true');
    const qs = params.toString();
    const res = await axiosForBackend({ url: `/api/entities${qs ? `?${qs}` : ''}`, method: 'GET' });
    return res.data;
  },
  getById: async (id: string): Promise<IEntity> => {
    const res = await axiosForBackend({ url: `/api/entities/${id}`, method: 'GET' });
    return res.data;
  },
  create: async (data: Partial<IEntity>): Promise<IEntity> => {
    const res = await axiosForBackend({ url: '/api/entities', method: 'POST', data });
    return res.data;
  },
  update: async (id: string, data: Partial<IEntity>): Promise<IEntity> => {
    const res = await axiosForBackend({ url: `/api/entities/${id}`, method: 'PUT', data });
    return res.data;
  },
  remove: async (id: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({ url: `/api/entities/${id}`, method: 'DELETE' });
    return res.data;
  },
};
