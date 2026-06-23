import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// string[] 增删编辑器：展示已有 chip（带 ✕），底部输入框回车/失焦添加
export default function ChipEditor({
  value,
  onChange,
  placeholder = '输入后回车添加',
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className={cn('rounded-md border border-input bg-background p-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag, i) => (
          <span
            key={`${tag}-${i}`}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent px-1 text-sm outline-none"
        />
      </div>
    </div>
  );
}
