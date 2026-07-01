import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import ChipEditor from '@/components/ChipEditor';
import PairListEditor from '@/components/PairListEditor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export type SimpleFieldType = 'text' | 'textarea' | 'chips' | 'links' | 'select' | 'switch';

export interface SimpleField {
  key: string;
  label: string;
  type: SimpleFieldType;
  placeholder?: string;
  required?: boolean;
  /** select 类型的选项 */
  options?: { label: string; value: string }[];
  /** 字段下方的灰色帮助说明 */
  hint?: string;
}

// 通用编辑/新增弹窗，用于字段较少的 events / sources。
// links 字段以 [label,url][] 存储，内部用 PairListEditor 行编辑。
export default function SimpleEditModal<T extends Record<string, any>>({
  title,
  fields,
  initial,
  isCreate,
  open,
  onOpenChange,
  onSave,
  onDelete,
  saving,
}: {
  title: string;
  fields: SimpleField[];
  initial: Partial<T>;
  isCreate: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<T>) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<Record<string, any>>({});

  useEffect(() => {
    if (open) setForm({ ...initial });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, (initial as any)?.id, isCreate]);

  if (!open) return null;

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const linkRows = (key: string) =>
    ((form[key] as [string, string][]) || []).map(([label, url]) => ({ label, url }));
  const setLinkRows = (key: string, rows: Record<string, string>[]) =>
    set(key, rows.map((r) => [r.label || '', r.url || '']) as [string, string][]);

  const handleSave = () => {
    for (const f of fields) {
      if (f.required && !String(form[f.key] || '').trim()) {
        toast.error(`${f.label}不能为空`);
        return;
      }
    }
    const payload = { ...form };
    // 清洗 links 空行
    for (const f of fields) {
      if (f.type === 'links') {
        payload[f.key] = ((payload[f.key] as [string, string][]) || []).filter(([l, u]) => l || u);
      }
    }
    onSave(payload as Partial<T>);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-lg overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-3 pt-5">
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-160px)]">
          <div className="space-y-3 px-6 py-4">
            {fields.map((f) => (
              <div key={f.key}>
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  {f.label}
                  {f.required && ' *'}
                </p>
                {f.type === 'text' && (
                  <Input
                    value={form[f.key] || ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}
                {f.type === 'textarea' && (
                  <Textarea
                    value={form[f.key] || ''}
                    onChange={(e) => set(f.key, e.target.value)}
                    rows={3}
                    placeholder={f.placeholder}
                  />
                )}
                {f.type === 'select' && (
                  <Select value={form[f.key] ?? ''} onValueChange={(v) => set(f.key, v)}>
                    <SelectTrigger><SelectValue placeholder={f.placeholder} /></SelectTrigger>
                    <SelectContent>
                      {(f.options || []).map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {f.type === 'switch' && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!form[f.key]}
                      onChange={(e) => set(f.key, e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm">{f.placeholder || '启用'}</span>
                  </label>
                )}
                {f.type === 'chips' && (
                  <ChipEditor value={form[f.key] || []} onChange={(v) => set(f.key, v)} placeholder={f.placeholder} />
                )}
                {f.type === 'links' && (
                  <PairListEditor
                    rows={linkRows(f.key)}
                    fields={[
                      { key: 'label', placeholder: '名称，如 官网' },
                      { key: 'url', placeholder: 'https://' },
                    ]}
                    onChange={(rows) => setLinkRows(f.key, rows)}
                    addLabel="添加链接"
                  />
                )}
                {f.hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">{f.hint}</p>}
              </div>
            ))}

            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <div>
                {!isCreate && onDelete && (
                  <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:bg-destructive/5">
                    <Trash2 className="size-4" />
                    删除
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : isCreate ? '创建' : '保存'}
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
