import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { userApi } from '@/api/user';
import type { IUser, UserRole } from '@/api/types';

function errMsg(e: any, fallback: string): string {
  return e?.response?.data?.message || fallback;
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => userApi.getList(),
    enabled,
    staleTime: 60 * 1000,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: (data: { username: string; password: string; role: UserRole; displayName?: string }) =>
      userApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('用户已创建');
    },
    onError: (e) => toast.error(errMsg(e, '创建失败')),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: UserRole; displayName?: string } }) =>
      userApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('用户已更新');
    },
    onError: (e) => toast.error(errMsg(e, '更新失败')),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, newPassword }: { id: string; newPassword: string }) =>
      userApi.resetPassword(id, newPassword),
    onSuccess: () => toast.success('密码已重置'),
    onError: (e) => toast.error(errMsg(e, '重置失败')),
  });

  const remove = useMutation({
    mutationFn: (user: IUser) => userApi.remove(user.id),
    onSuccess: () => {
      invalidate();
      toast.success('用户已删除');
    },
    onError: (e) => toast.error(errMsg(e, '删除失败')),
  });

  return { create, update, resetPassword, remove };
}
