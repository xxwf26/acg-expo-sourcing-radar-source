import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// 通用"行编辑器"：每行若干文本字段 + 删除；底部添加一行。
// 用于 links（[label, url]）和 visuals（{title, caption, url}）。
// 通过 fields 描述每行的字段，rows 是对象数组，统一以对象形态编辑，
// 调用方负责把对象 <-> 元组/结构互转。

export interface FieldSpec {
  key: string;
  placeholder: string;
}

export default function PairListEditor({
  rows,
  fields,
  onChange,
  addLabel = '添加一行',
}: {
  rows: Record<string, string>[];
  fields: FieldSpec[];
  onChange: (next: Record<string, string>[]) => void;
  addLabel?: string;
}) {
  const update = (i: number, key: string, val: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    onChange(next);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => {
    const blank: Record<string, string> = {};
    fields.forEach((f) => (blank[f.key] = ''));
    onChange([...rows, blank]);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {fields.map((f) => (
            <input
              key={f.key}
              value={row[f.key] ?? ''}
              onChange={(e) => update(i, f.key, e.target.value)}
              placeholder={f.placeholder}
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus:border-primary"
            />
          ))}
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
