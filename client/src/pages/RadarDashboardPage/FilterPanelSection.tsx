import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TYPE_OPTIONS, PRIORITY_OPTIONS, ANGLE_OPTIONS } from '@/lib/filterConfig';
import type { IEvent } from '@/api/types';

export interface FilterState {
  search: string;
  types: string[];
  priorities: string[];
  event: string; // 'all' 或 event id
  angle: string; // 'all' 或视角值
}

export const DEFAULT_FILTERS: FilterState = {
  search: '',
  types: [],
  priorities: [],
  event: 'all',
  angle: 'all',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="h-3 w-1 rounded-full bg-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors',
        checked ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary',
      )}
    >
      <Checkbox checked={checked} className="pointer-events-none" />
      <span>{label}</span>
    </div>
  );
}

function Pill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-accent font-bold text-accent-foreground'
          : 'border-border bg-card text-foreground hover:border-primary/50',
      )}
    >
      {label}
    </button>
  );
}

export default function FilterPanelSection({
  filters,
  onChange,
  events,
}: {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  events: IEvent[];
}) {
  const toggleArr = (key: 'types' | 'priorities', value: string) => {
    const cur = filters[key];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    onChange({ ...filters, [key]: next });
  };

  return (
    <div>
      <Section title="搜索">
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="搜展会、艺术家、供应商、标签"
          type="search"
        />
      </Section>

      <Section title="展会">
        <Select
          value={filters.event}
          onValueChange={(v) => onChange({ ...filters, event: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部展会</SelectItem>
            {events.map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.short} · {ev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>

      <Section title="对象类型">
        <div className="space-y-0.5">
          {TYPE_OPTIONS.map((opt) => (
            <CheckRow
              key={opt.value}
              label={opt.label}
              checked={filters.types.includes(opt.value)}
              onToggle={() => toggleArr('types', opt.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="优先级">
        <div className="flex gap-1.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <Pill
              key={opt.value}
              label={opt.label}
              active={filters.priorities.includes(opt.value)}
              onClick={() => toggleArr('priorities', opt.value)}
            />
          ))}
        </div>
      </Section>

      <Section title="采购视角">
        <Select
          value={filters.angle}
          onValueChange={(v) => onChange({ ...filters, angle: v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部机会</SelectItem>
            {ANGLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Section>
    </div>
  );
}
