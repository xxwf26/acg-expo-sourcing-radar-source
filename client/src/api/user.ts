import axiosForBackend from './index';
import type { IUser, IListResponse, UserRole } from './types';

export const userApi = {
  getList: async (): Promise<IListResponse<IUser>> => {
    const res = await axiosForBackend({ url: '/api/users', method: 'GET' });
    return res.data;
  },
  create: async (data: {
    username: string;
    password: string;
    role: UserRole;
    displayName?: string;
  }): Promise<IUser> => {
    const res = await axiosForBackend({ url: '/api/users', method: 'POST', data });
    return res.data;
  },
  update: async (
    id: string,
    data: { role?: UserRole; displayName?: string },
  ): Promise<IUser> => {
    const res = await axiosForBackend({ url: `/api/users/${id}`, method: 'PUT', data });
    return res.data;
  },
  resetPassword: async (id: string, newPassword: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({
      url: `/api/users/${id}/password`,
      method: 'PUT',
      data: { newPassword },
    });
    return res.data;
  },
  remove: async (id: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({ url: `/api/users/${id}`, method: 'DELETE' });
    return res.data;
  },
};

// 自助改密：任何登录用户改自己的密码
export const authApi = {
  changePassword: async (oldPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    const res = await axiosForBackend({
      url: '/api/auth/password',
      method: 'PUT',
      data: { oldPassword, newPassword },
    });
    return res.data;
  },
};
