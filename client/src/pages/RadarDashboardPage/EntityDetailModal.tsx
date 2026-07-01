import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ChipEditor from '@/components/ChipEditor';
import PairListEditor from '@/components/PairListEditor';
import AiPanel from '@/components/AiPanel';
import ContactFinder from '@/components/ContactFinder';
import { cn } from '@/lib/utils';
import {
  PRIORITY_STYLE,
  TYPE_STYLE,
  ENGAGEMENT_STATUS_STYLE,
  screenshotUrl,
  isBoothUncertain,
} from '@/lib/badgeStyles';
import { TYPE_LABELS, ENGAGEMENT_STATUS_OPTIONS, TYPE_OPTIONS, ANGLE_OPTIONS } from '@/lib/filterConfig';
import { useUpsertEngagement } from '@/hooks/useEngagement';
import { useEntityMutations } from '@/hooks/useCrudMutations';
import type { IEntity, IEngagement, IEvent } from '@/api/types';
import { toast } from 'sonner';
import { MapPin, ExternalLink, Pencil, Trash2 } from 'lucide-react';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

// 空白对象模板（新增态）
const BLANK: Partial<IEntity> = {
  name: '',
  type: 'creatorKol',
  priority: 'A',
  score: 70,
  events: [],
  region: '',
  booth: '',
  followerScale: '',
  followerTier: '',
  followerNote: '',
  tags: [],
  angles: [],
  reason: '',
  cases: [],
  visuals: [],
  links: [],
  excluded: false,
};

export default function EntityDetailModal({
  entity,
  engagement,
  events,
  canEdit = false,
  isCreate = false,
  open,
  onOpenChange,
}: {
  entity: IEntity | null;
  engagement?: IEngagement;
  events: IEvent[];
  canEdit?: boolean;
  isCreate?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useUpsertEngagement();
  const { create, update, remove } = useEntityMutations();

  // 建联状态（仅查看态用）
  const [status, setStatus] = useState('待评估');
  const [owner, setOwner] = useState('');
  const [note, setNote] = useState('');

  // 编辑/新增态
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<IEntity>>(BLANK);

  useEffect(() => {
    if (!open) return;
    if (isCreate) {
      setEditing(true);
      setForm({ ...BLANK });
    } else if (entity) {
      setEditing(false);
      setForm({ ...entity });
      setStatus(engagement?.status || '待评估');
      setOwner(engagement?.owner || '');
      setNote(engagement?.note || '');
    }
  }, [open, isCreate, entity?.id, engagement?.status, engagement?.owner, engagement?.note]);

  if (!open) return null;
  if (!isCreate && !entity) return null;

  const eventShort = (id: string) => events.find((e) => e.id === id)?.short || id;

  const saveEngagement = (patch: Partial<Pick<IEngagement, 'status' | 'owner' | 'note'>>) => {
    if (!entity) return;
    upsert.mutate({ entityId: entity.id, data: patch }, { onError: () => toast.error('保存失败，请重试') });
  };

  const set = (k: keyof IEntity, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // links: [label,url][] <-> rows {label,url}
  const linkRows = (form.links || []).map(([label, url]) => ({ label, url }));
  const setLinkRows = (rows: Record<string, string>[]) =>
    set('links', rows.map((r) => [r.label || '', r.url || '']) as [string, string][]);

  // visuals: {title,caption,url}[] <-> rows
  const visualRows = (form.visuals || []).map((v) => ({ title: v.title, caption: v.caption, url: v.url }));
  const setVisualRows = (rows: Record<string, string>[]) =>
    set('visuals', rows.map((r) => ({ title: r.title || '', caption: r.caption || '', url: r.url || '' })));

  const toggleEvent = (id: string) => {
    const cur = form.events || [];
    set('events', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const handleSave = () => {
    if (!form.name?.trim()) {
      toast.error('名称不能为空');
      return;
    }
    // 清洗：links/visuals 去掉空行
    const payload: Partial<IEntity> = {
      ...form,
      links: (form.links || []).filter(([l, u]) => l || u),
      visuals: (form.visuals || []).filter((v) => v.title || v.url),
    };
    if (isCreate) {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    } else if (entity) {
      update.mutate({ id: entity.id, data: payload }, { onSuccess: () => setEditing(false) });
    }
  };

  const handleDelete = () => {
    if (!entity) return;
    if (!confirm(`确认删除「${entity.name}」？此操作不可撤销。`)) return;
    remove.mutate(entity.id, { onSuccess: () => onOpenChange(false) });
  };

  const saving = create.isPending || update.isPending;
  const cur = (isCreate ? form : entity) as IEntity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-lg">
                {isCreate ? '新增建联对象' : editing ? `编辑：${entity?.name}` : entity?.name}
              </DialogTitle>
              {!isCreate && !editing && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {TYPE_LABELS[cur.type]} · {cur.region}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!editing && !isCreate && (
                <>
                  <Badge variant="outline" className={cn('border', PRIORITY_STYLE[cur.priority])}>
                    {cur.priority} 优先
                  </Badge>
                  <Badge variant="outline" className={cn('border', TYPE_STYLE[cur.type])}>
                    {TYPE_LABELS[cur.type]}
                  </Badge>
                  <div className="text-right">
                    <div className="text-xl font-bold leading-none text-primary">{cur.score}</div>
                    <div className="text-[10px] text-muted-foreground">匹配分</div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      // 进入编辑时从最新 entity 重建 form，避免后台 refetch 后编辑到旧数据
                      onClick={() => {
                        if (entity) setForm({ ...entity });
                        setEditing(true);
                      }}
                      className="ml-1"
                    >
                      <Pencil className="size-4" />
                      编辑
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-4 px-6 py-4">
            {editing ? (
              /* ============ 编辑 / 新增表单 ============ */
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="名称 *">
                    <Input value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="对象名称" />
                  </Field>
                  <Field label="地区">
                    <Input value={form.region || ''} onChange={(e) => set('region', e.target.value)} placeholder="如 北美 / 日本" />
                  </Field>
                  <Field label="类型 *">
                    <Select value={form.type} onValueChange={(v) => set('type', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="优先级 *">
                    <Select value={form.priority} onValueChange={(v) => set('priority', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['S', 'A', 'B'].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="匹配分 (0-100)">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={form.score ?? 0}
                      onChange={(e) => {
                        // 空输入允许暂存为 0，但 clamp 到 0-100，防 NaN/越界
                        const n = Number(e.target.value);
                        set('score', Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n)));
                      }}
                    />
                  </Field>
                  <Field label="展位 / 位置线索">
                    <Input value={form.booth || ''} onChange={(e) => set('booth', e.target.value)} placeholder="如 AX WH-1128" />
                  </Field>
                </div>

                <Field label="关联展会">
                  <div className="flex flex-wrap gap-1.5">
                    {events.map((ev) => {
                      const active = (form.events || []).includes(ev.id);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => toggleEvent(ev.id)}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-xs transition-colors',
                            active
                              ? 'border-primary bg-accent font-semibold text-accent-foreground'
                              : 'border-border hover:border-primary/50',
                          )}
                        >
                          {ev.short}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="采购视角">
                  <div className="flex flex-wrap gap-1.5">
                    {ANGLE_OPTIONS.map((o) => {
                      const active = (form.angles || []).includes(o.value);
                      return (
                        <button
                          key={o.value}
                          type="button"
                          onClick={() => {
                            const cur2 = form.angles || [];
                            set('angles', cur2.includes(o.value) ? cur2.filter((x) => x !== o.value) : [...cur2, o.value]);
                          }}
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-xs transition-colors',
                            active ? 'border-primary bg-accent font-semibold text-accent-foreground' : 'border-border hover:border-primary/50',
                          )}
                        >
                          {o.value}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                <Field label="标签">
                  <ChipEditor value={form.tags || []} onChange={(v) => set('tags', v)} placeholder="输入标签后回车" />
                </Field>

                <Field label="推荐理由">
                  <Textarea value={form.reason || ''} onChange={(e) => set('reason', e.target.value)} rows={3} placeholder="为什么值得建联" />
                </Field>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="粉丝量级">
                    <Input value={form.followerScale || ''} onChange={(e) => set('followerScale', e.target.value)} placeholder="如 IG 约 326K" />
                  </Field>
                  <Field label="KOL 分层">
                    <Input value={form.followerTier || ''} onChange={(e) => set('followerTier', e.target.value)} placeholder="如 L3：30万+" />
                  </Field>
                </div>
                <Field label="粉丝数据说明">
                  <Input value={form.followerNote || ''} onChange={(e) => set('followerNote', e.target.value)} placeholder="可选" />
                </Field>

                <Field label="代表案例 / 风格线索">
                  <ChipEditor value={form.cases || []} onChange={(v) => set('cases', v)} placeholder="输入案例后回车" />
                </Field>

                <Field label="视觉预览（标题 / 说明 / URL）">
                  <PairListEditor
                    rows={visualRows}
                    fields={[
                      { key: 'title', placeholder: '标题' },
                      { key: 'caption', placeholder: '说明' },
                      { key: 'url', placeholder: 'https://' },
                    ]}
                    onChange={setVisualRows}
                    addLabel="添加预览"
                  />
                </Field>

                <Field label="链接（名称 / URL）">
                  <PairListEditor
                    rows={linkRows}
                    fields={[
                      { key: 'label', placeholder: '名称，如 官网' },
                      { key: 'url', placeholder: 'https://' },
                    ]}
                    onChange={setLinkRows}
                    addLabel="添加链接"
                  />
                </Field>

                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={!!form.excluded} onCheckedChange={(v) => set('excluded', !!v)} />
                  <span className="text-sm">标记为"非营销采购窗口"（默认列表隐藏）</span>
                </label>

                {/* 底部操作 */}
                <div className="flex items-center justify-between gap-2 border-t pt-4">
                  <div>
                    {!isCreate && (
                      <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/5">
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (isCreate ? onOpenChange(false) : setEditing(false))}
                    >
                      取消
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? '保存中...' : isCreate ? '创建' : '保存'}
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              /* ============ 查看态 ============ */
              <>
                {/* 关联展会 + 展位 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {(cur.events || []).map((id) => (
                    <Badge key={id} variant="secondary">{eventShort(id)}</Badge>
                  ))}
                  {cur.booth && (
                    <span className={cn('flex items-center gap-1 text-xs', isBoothUncertain(cur.booth) ? 'text-amber-600' : 'text-muted-foreground')}>
                      <MapPin className="size-3" />
                      {isBoothUncertain(cur.booth) ? '位置线索' : '展位'}：{cur.booth}
                    </span>
                  )}
                </div>

                {cur.tags && cur.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {cur.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="font-normal">{t}</Badge>
                    ))}
                  </div>
                )}

                {cur.reason && (
                  <Field label="推荐理由">
                    <p className="text-sm leading-relaxed">{cur.reason}</p>
                  </Field>
                )}

                {(cur.followerScale || cur.followerTier) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="粉丝量级">
                      <p className="text-sm">{cur.followerScale || '待复核'}</p>
                      {cur.followerNote && <p className="mt-1 text-xs text-muted-foreground">{cur.followerNote}</p>}
                    </Field>
                    <Field label="KOL 分层">
                      <p className="text-sm">{cur.followerTier || '未分层'}</p>
                    </Field>
                  </div>
                )}

                {cur.cases && cur.cases.length > 0 && (
                  <Field label="代表案例 / 风格线索">
                    <p className="text-sm leading-relaxed text-muted-foreground">{cur.cases.join(' · ')}</p>
                  </Field>
                )}

                {cur.visuals && cur.visuals.length > 0 && (
                  <Field label="视觉预览">
                    <div className="grid grid-cols-2 gap-2">
                      {cur.visuals.slice(0, 2).map((v, i) => (
                        <a key={`${v.url}-${i}`} href={v.url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border">
                          <img
                            src={screenshotUrl(v.url)}
                            alt={`${cur.name} - ${v.title}`}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                            className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="p-2">
                            <p className="text-xs font-medium">{v.title}</p>
                            <p className="text-[11px] text-muted-foreground">{v.caption}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </Field>
                )}

                {cur.links && cur.links.length > 0 && (
                  <Field label="链接">
                    <div className="flex flex-wrap gap-2">
                      {cur.links.map(([label, url], i) => (
                        <a key={`${url}-${i}`} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent">
                          {label}
                          <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </Field>
                )}

                {/* 建联状态维护 */}
                <div className="rounded-lg border bg-secondary/40 p-4">
                  <p className="mb-3 text-sm font-semibold">
                    建联维护
                    {!canEdit && <span className="ml-2 text-xs font-normal text-muted-foreground">（只读用户不可编辑）</span>}
                  </p>
                  {canEdit ? (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="建联状态">
                          <Select value={status} onValueChange={(v) => { setStatus(v); saveEngagement({ status: v }); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ENGAGEMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <Field label="负责人">
                          <Input value={owner} onChange={(e) => setOwner(e.target.value)} onBlur={() => { if (owner !== (engagement?.owner || '')) saveEngagement({ owner }); }} placeholder="采购/业务姓名" />
                        </Field>
                      </div>
                      <div className="mt-3">
                        <Field label="备注">
                          <Textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (engagement?.note || '')) saveEngagement({ note }); }} rows={3} placeholder="可记录 booth 拜访结果、联系人、报价、风险、业务反馈" />
                        </Field>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">状态即改即存，负责人/备注失焦保存。多人协作可见。</p>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="建联状态">
                          <Badge variant="outline" className={cn('border', ENGAGEMENT_STATUS_STYLE[status] || ENGAGEMENT_STATUS_STYLE['待评估'])}>{status}</Badge>
                        </Field>
                        <Field label="负责人"><p className="text-sm">{owner || '—'}</p></Field>
                      </div>
                      <Field label="备注"><p className="whitespace-pre-wrap text-sm text-muted-foreground">{note || '—'}</p></Field>
                    </div>
                  )}
                </div>

                {/* AI 总结 + 半自动找联系方式（查看态；登录用户均可点，viewer 亦可） */}
                {entity && (
                  <div className="space-y-3">
                    <AiPanel entityId={entity.id} />
                    <ContactFinder name={entity.name} region={entity.region} />
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
