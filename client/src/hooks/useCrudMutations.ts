import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { entityApi } from '@/api/entity';
import { eventApi } from '@/api/event';
import { sourceApi } from '@/api/source';
import type { IEntity, IEvent, ISource } from '@/api/types';

// 提取后端返回的错误信息（引用保护/校验失败等）
function errMsg(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
}

// ---------------- entities ----------------
export function useEntityMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['entities'] });

  const create = useMutation({
    mutationFn: (data: Partial<IEntity>) => entityApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('对象已新增');
    },
    onError: (e) => toast.error(errMsg(e, '新增失败')),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IEntity> }) => entityApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('对象已更新');
    },
    onError: (e) => toast.error(errMsg(e, '更新失败')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => entityApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('对象已删除');
    },
    onError: (e) => toast.error(errMsg(e, '删除失败')),
  });

  return { create, update, remove };
}

// ---------------- events ----------------
export function useEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['events'] });

  const create = useMutation({
    mutationFn: (data: Partial<IEvent>) => eventApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('展会已新增');
    },
    onError: (e) => toast.error(errMsg(e, '新增失败')),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<IEvent> }) => eventApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('展会已更新');
    },
    onError: (e) => toast.error(errMsg(e, '更新失败')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => eventApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('展会已删除');
    },
    onError: (e) => toast.error(errMsg(e, '删除失败')),
  });

  return { create, update, remove };
}

// ---------------- sources ----------------
export function useSourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['sources'] });

  const create = useMutation({
    mutationFn: (data: Partial<ISource>) => sourceApi.create(data),
    onSuccess: () => {
      invalidate();
      toast.success('信息源已新增');
    },
    onError: (e) => toast.error(errMsg(e, '新增失败')),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ISource> }) => sourceApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('信息源已更新');
    },
    onError: (e) => toast.error(errMsg(e, '更新失败')),
  });

  const remove = useMutation({
    mutationFn: (id: string) => sourceApi.remove(id),
    onSuccess: () => {
      invalidate();
      toast.success('信息源已删除');
    },
    onError: (e) => toast.error(errMsg(e, '删除失败')),
  });

  return { create, update, remove };
}
