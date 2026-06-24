import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, KeyRound, Trash2, ShieldCheck } from 'lucide-react';
import { useUsers, useUserMutations } from '@/hooks/useUsers';
import { useAuth } from '@/lib/auth';
import type { IUser, UserRole } from '@/api/types';

const ROLE_LABEL: Record<UserRole, string> = { admin: '管理员', viewer: '只读' };

// admin 专用账号管理：列出/新增/改资料与角色/重置密码/删除。
export default function UserManageModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user: me } = useAuth();
  const usersQuery = useUsers(open);
  const { create, update, resetPassword, remove } = useUserMutations();
  const list = usersQuery.data?.list || [];

  // 新增表单
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ username: string; password: string; role: UserRole; displayName: string }>({
    username: '',
    password: '',
    role: 'viewer',
    displayName: '',
  });

  const resetForm = () => setForm({ username: '', password: '', role: 'viewer', displayName: '' });

  const submitCreate = () => {
    if (!form.username.trim()) return;
    if (form.password.length < 6) return;
    create.mutate(
      {
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        displayName: form.displayName.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetForm();
          setCreating(false);
        },
      },
    );
  };

  const onReset = (u: IUser) => {
    const pwd = window.prompt(`为「${u.displayName || u.username}」设置新密码（至少 6 位）：`);
    if (pwd === null) return;
    if (pwd.length < 6) {
      window.alert('密码至少 6 位');
      return;
    }
    resetPassword.mutate({ id: u.id, newPassword: pwd });
  };

  const onDelete = (u: IUser) => {
    if (!window.confirm(`确认删除用户「${u.displayName || u.username}」？此操作不可撤销。`)) return;
    remove.mutate(u);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5 text-primary" />
            账号管理
          </DialogTitle>
          <DialogDescription>管理登录账号与权限。管理员可浏览并维护建联，只读用户仅浏览。</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-150px)]">
          <div className="space-y-4 px-6 py-4">
            {/* 用户列表 */}
            <div className="overflow-hidden rounded-lg border">
              {usersQuery.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">加载中…</p>
              ) : (
                list.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{u.displayName || u.username}</span>
                        {u.username === me?.username ? (
                          <Badge variant="secondary" className="text-[10px]">我</Badge>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                    </div>
                    <Select
                      value={u.role}
                      onValueChange={(v) => update.mutate({ id: u.id, data: { role: v as UserRole } })}
                    >
                      <SelectTrigger className="h-8 w-24 shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理员</SelectItem>
                        <SelectItem value="viewer">只读</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => onReset(u)}>
                      <KeyRound className="size-3.5" />
                      重置密码
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-destructive hover:bg-destructive/5"
                      // 不可删除自己（后端也有护栏，前端先拦截）
                      disabled={u.username === me?.username}
                      onClick={() => onDelete(u)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* 新增用户 */}
            {creating ? (
              <div className="space-y-3 rounded-lg border bg-secondary/30 p-4">
                <p className="text-sm font-semibold">新增用户</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">用户名 *</p>
                    <Input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="登录用用户名" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">显示名</p>
                    <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="如 张三" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">初始密码 *（至少 6 位）</p>
                    <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">角色</p>
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">只读</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setCreating(false); resetForm(); }}>取消</Button>
                  <Button
                    size="sm"
                    onClick={submitCreate}
                    disabled={create.isPending || !form.username.trim() || form.password.length < 6}
                  >
                    {create.isPending ? '创建中...' : '创建'}
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" />
                新增用户
              </Button>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
