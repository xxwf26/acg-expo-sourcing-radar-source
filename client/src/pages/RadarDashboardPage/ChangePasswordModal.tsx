import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { authApi } from '@/api/user';
import { useAuth } from '@/lib/auth';

// 自助改密弹窗：任何登录用户可用。改成功后强制重新登录（token 不变但密码已换，登出最稳妥）。
export default function ChangePasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { logout } = useAuth();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setOld('');
    setNew('');
    setConfirm('');
  };

  const handleSave = async () => {
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(oldPassword, newPassword);
      toast.success('密码已修改，请用新密码重新登录');
      reset();
      onOpenChange(false);
      logout();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '修改失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="w-full max-w-sm">
        <DialogHeader>
          <DialogTitle>修改密码</DialogTitle>
          <DialogDescription>修改成功后需用新密码重新登录。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">原密码</p>
            <Input type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">新密码（至少 6 位）</p>
            <Input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">确认新密码</p>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : '确认修改'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
