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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { PRIORITY_STYLE, TYPE_STYLE, screenshotUrl, isBoothUncertain } from '@/lib/badgeStyles';
import { TYPE_LABELS, ENGAGEMENT_STATUS_OPTIONS } from '@/lib/filterConfig';
import { useUpsertEngagement } from '@/hooks/useEngagement';
import type { IEntity, IEngagement, IEvent } from '@/api/types';
import { toast } from 'sonner';
import { MapPin, ExternalLink } from 'lucide-react';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export default function EntityDetailModal({
  entity,
  engagement,
  events,
  open,
  onOpenChange,
}: {
  entity: IEntity | null;
  engagement?: IEngagement;
  events: IEvent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const upsert = useUpsertEngagement();
  const [status, setStatus] = useState('待评估');
  const [owner, setOwner] = useState('');
  const [note, setNote] = useState('');

  // 打开/切换对象时，用已存的建联记录回填
  useEffect(() => {
    if (entity) {
      setStatus(engagement?.status || '待评估');
      setOwner(engagement?.owner || '');
      setNote(engagement?.note || '');
    }
  }, [entity?.id, engagement?.status, engagement?.owner, engagement?.note]);

  if (!entity) return null;

  const eventShort = (id: string) => events.find((e) => e.id === id)?.short || id;

  const save = (patch: Partial<Pick<IEngagement, 'status' | 'owner' | 'note'>>) => {
    upsert.mutate(
      { entityId: entity.id, data: patch },
      {
        onError: () => toast.error('保存失败，请重试'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-3 pt-5">
          <div className="flex items-start justify-between gap-3 pr-6">
            <div className="min-w-0">
              <DialogTitle className="text-lg">{entity.name}</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {TYPE_LABELS[entity.type]} · {entity.region}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className={cn('border', PRIORITY_STYLE[entity.priority])}>
                {entity.priority} 优先
              </Badge>
              <Badge variant="outline" className={cn('border', TYPE_STYLE[entity.type])}>
                {TYPE_LABELS[entity.type]}
              </Badge>
              <div className="text-right">
                <div className="text-xl font-bold leading-none text-primary">{entity.score}</div>
                <div className="text-[10px] text-muted-foreground">匹配分</div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="space-y-4 px-6 py-4">
            {/* 关联展会 + 展位 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(entity.events || []).map((id) => (
                <Badge key={id} variant="secondary">
                  {eventShort(id)}
                </Badge>
              ))}
              {entity.booth && (
                <span
                  className={cn(
                    'flex items-center gap-1 text-xs',
                    isBoothUncertain(entity.booth) ? 'text-amber-600' : 'text-muted-foreground',
                  )}
                >
                  <MapPin className="size-3" />
                  {isBoothUncertain(entity.booth) ? '位置线索' : '展位'}：{entity.booth}
                </span>
              )}
            </div>

            {/* 标签 */}
            {entity.tags && entity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {entity.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            {/* 推荐理由 */}
            {entity.reason && (
              <Field label="推荐理由">
                <p className="text-sm leading-relaxed">{entity.reason}</p>
              </Field>
            )}

            {/* 粉丝数据 */}
            {(entity.followerScale || entity.followerTier) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="粉丝量级">
                  <p className="text-sm">{entity.followerScale || '待复核'}</p>
                  {entity.followerNote && (
                    <p className="mt-1 text-xs text-muted-foreground">{entity.followerNote}</p>
                  )}
                </Field>
                <Field label="KOL 分层">
                  <p className="text-sm">{entity.followerTier || '未分层'}</p>
                </Field>
              </div>
            )}

            {/* 代表案例 */}
            {entity.cases && entity.cases.length > 0 && (
              <Field label="代表案例 / 风格线索">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {entity.cases.join(' · ')}
                </p>
              </Field>
            )}

            {/* 视觉预览 */}
            {entity.visuals && entity.visuals.length > 0 && (
              <Field label="视觉预览">
                <div className="grid grid-cols-2 gap-2">
                  {entity.visuals.slice(0, 2).map((v) => (
                    <a
                      key={v.url}
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group overflow-hidden rounded-lg border"
                    >
                      <img
                        src={screenshotUrl(v.url)}
                        alt={`${entity.name} - ${v.title}`}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-32 w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="p-2">
                        <p className="text-xs font-medium">{v.title}</p>
                        <p className="text-[11px] text-muted-foreground">{v.caption}</p>
                      </div>
                    </a>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  缩略图为官网/作品集/商店页预览，用于快速判断风格；正式合作前仍需进入来源页核对版权与最新作品。
                </p>
              </Field>
            )}

            {/* 链接 */}
            {entity.links && entity.links.length > 0 && (
              <Field label="链接">
                <div className="flex flex-wrap gap-2">
                  {entity.links.map(([label, url]) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
                    >
                      {label}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              </Field>
            )}

            {/* 建联状态维护（核心写操作，存后端） */}
            <div className="rounded-lg border bg-secondary/40 p-4">
              <p className="mb-3 text-sm font-semibold">建联维护</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="建联状态">
                  <Select
                    value={status}
                    onValueChange={(v) => {
                      setStatus(v);
                      save({ status: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENGAGEMENT_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="负责人">
                  <Input
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    onBlur={() => save({ owner })}
                    placeholder="采购/业务姓名"
                  />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="备注">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => save({ note })}
                    placeholder="可记录 booth 拜访结果、联系人、报价、风险、业务反馈"
                    rows={3}
                  />
                </Field>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                状态即改即存，负责人/备注失焦保存。多人协作可见，刷新或换设备不丢失。
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
