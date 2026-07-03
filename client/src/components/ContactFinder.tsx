import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ExternalLink, Copy, Check, Plus, Trash2, ShieldCheck, Mail, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useEntityMutations } from '@/hooks/useCrudMutations';
import { useAuth } from '@/lib/auth';
import type { IEntity, IContact, EntityType } from '@/api/types';

interface ContactFinderProps {
  entity: IEntity;
  canEdit?: boolean;
}

/** 一个搜索入口：平台名 + 构造好的直达搜索 URL */
interface SearchTarget {
  label: string;
  hint?: string;
  url: (q: string) => string;
}

// ── 各平台直达搜索链接构造器（纯拼 URL，不调任何 API）──
// 用 Google site: dork 兜底那些搜索页需登录/端点易变的平台（Instagram/X），比站内搜索页更稳。
const T = {
  google: { label: 'Google', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} artist illustrator`)}` },
  x: { label: 'X / Twitter', url: (q: string) => `https://x.com/search?q=${encodeURIComponent(q)}&f=user` },
  xViaGoogle: { label: 'X（Google）', hint: 'X 站内搜索需登录，用 Google 兜底', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} (site:x.com OR site:twitter.com)`)}` },
  igViaGoogle: { label: 'Instagram（Google）', hint: 'IG 站内搜索端点易失效，用 Google 兜底', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:instagram.com`)}` },
  pixiv: { label: 'pixiv', hint: '日系画师常驻', url: (q: string) => `https://www.pixiv.net/tags/${encodeURIComponent(q)}/artworks` },
  booth: { label: 'BOOTH', hint: '日系画师周边/委托', url: (q: string) => `https://booth.pm/zh-cn/search/${encodeURIComponent(q)}` },
  artstation: { label: 'ArtStation', hint: '欧美美术', url: (q: string) => `https://www.artstation.com/search?query=${encodeURIComponent(q)}` },
  behance: { label: 'Behance', hint: '欧美设计/美术', url: (q: string) => `https://www.behance.net/search/users?search=${encodeURIComponent(q)}` },
  weibo: { label: '微博', url: (q: string) => `https://s.weibo.com/user?q=${encodeURIComponent(q)}` },
  bilibili: { label: 'Bilibili', url: (q: string) => `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(q)}` },
  xhs: { label: '小红书', url: (q: string) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}` },
  linkedin: { label: 'LinkedIn（Google）', hint: '供应商/公司', url: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} (site:linkedin.com/company OR site:linkedin.com/in)`)}` },
  tianyancha: { label: '天眼查', hint: '国内公司工商', url: (q: string) => `https://www.tianyancha.com/search?key=${encodeURIComponent(q)}` },
  alibaba1688: { label: '1688', hint: '国内供应链', url: (q: string) => `https://s.1688.com/company/company_search.htm?keywords=${encodeURIComponent(q)}` },
} satisfies Record<string, SearchTarget>;

// 判定亚洲地区（决定日系/国内平台优先）
function isAsia(region?: string | null): boolean {
  if (!region) return false;
  return /中|华|国|日|本|韩|台|港|亚|asia|china|japan|korea|taiwan|hong/i.test(region);
}

/** 按对象类型 + 地区返回分组搜索入口：优先组（高命中）+ 其他组（兜底） */
function targetsFor(type: EntityType, region?: string | null): { primary: SearchTarget[]; more: SearchTarget[] } {
  const asia = isAsia(region);
  if (type === 'supplier' || type === 'master') {
    // 供应商/主体：走公司/工商/职业网络
    return {
      primary: asia ? [T.tianyancha, T.alibaba1688, T.linkedin, T.google] : [T.linkedin, T.google, T.behance],
      more: [T.artstation, T.xViaGoogle, T.weibo],
    };
  }
  if (type === 'platform') {
    return { primary: [T.google, T.linkedin], more: [T.xViaGoogle, T.weibo] };
  }
  // creatorKol（画师/KOL）：按地区分日系 vs 欧美
  if (asia) {
    return {
      primary: [T.pixiv, T.booth, T.weibo, T.bilibili, T.xhs],
      more: [T.xViaGoogle, T.igViaGoogle, T.google],
    };
  }
  return {
    primary: [T.xViaGoogle, T.artstation, T.behance, T.igViaGoogle],
    more: [T.pixiv, T.booth, T.google],
  };
}

// Google 精准 dork：直接逼近邮箱 / 商务合作页
const DORKS = [
  { label: '找邮箱', icon: Mail, q: (n: string) => `"${n}" (email OR contact OR 商务合作 OR business) (gmail.com OR outlook.com OR "@")` },
  { label: '找官网/合作', icon: Globe, q: (n: string) => `"${n}" (official OR 官网 OR commission OR 约稿 OR 合作 OR 报价)` },
];

// 联系方式渠道选项
const CHANNELS: { value: string; label: string }[] = [
  { value: 'email', label: '邮箱' },
  { value: 'wechat', label: '微信' },
  { value: 'x', label: 'X / Twitter' },
  { value: 'website', label: '官网' },
  { value: 'qq', label: 'QQ' },
  { value: 'phone', label: '电话' },
  { value: 'other', label: '其他' },
];
const channelLabel = (v: string) => CHANNELS.find((c) => c.value === v)?.label || v;

/**
 * 找联系方式（Tier1 搜索入口 + 落库闭环）。
 * - 搜索入口按对象类型/地区智能分组、修死链、加 Google dork（零 API、纯拼 URL 人工核对）。
 * - 核实到的邮箱/微信/官网可录入 entity.contacts 持久化，并盖「最近核实人/时间」，多人协作可见、可导出。
 */
export default function ContactFinder({ entity, canEdit = false }: ContactFinderProps) {
  const { user } = useAuth();
  const { update } = useEntityMutations();
  const [open, setOpen] = useState(false);
  const [withRegion, setWithRegion] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);
  // 卸载时清理复制态定时器，避免 setState on unmounted
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // 新增联系方式的草稿
  const [draftChannel, setDraftChannel] = useState('email');
  const [draftValue, setDraftValue] = useState('');

  const name = entity.name;
  const region = entity.region;
  const query = withRegion && region ? `${name} ${region}` : name;
  const groups = useMemo(() => targetsFor(entity.type, region), [entity.type, region]);

  // 本地维护 contacts 作为编辑基准：连续增删以最新本地值为准，避免用渲染快照 +
  // 无乐观更新的 mutation 造成「第一条被第二条覆盖」的数据丢失。服务端数据变化时同步回来。
  const [contacts, setContacts] = useState<IContact[]>(entity.contacts ?? []);
  useEffect(() => {
    setContacts(entity.contacts ?? []);
  }, [entity.id, entity.contacts]);

  const copyQuery = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动选择');
    }
  };

  // 保存联系方式列表（同时后端会自动盖 contactCheckedAt；这里带上核实人）
  const persist = (next: IContact[]) => {
    setContacts(next); // 先本地更新，作为后续操作的基准
    update.mutate({
      id: entity.id,
      data: { contacts: next, contactCheckedBy: user?.displayName || user?.username || 'unknown' },
    });
  };

  const addContact = () => {
    const v = draftValue.trim();
    if (!v) {
      toast.error('请输入联系方式内容');
      return;
    }
    persist([...contacts, { channel: draftChannel, value: v }]);
    setDraftValue('');
  };

  const removeContact = (idx: number) => {
    persist(contacts.filter((_, i) => i !== idx));
  };

  // 「标记已查过」：不改 contacts，仅刷新核实人/时间（原样回存现有 contacts）
  const markChecked = () => persist(contacts);

  const checkedLabel = entity.contactCheckedAt
    ? `上次核实：${entity.contactCheckedBy || '—'} · ${entity.contactCheckedAt.slice(0, 10)}`
    : '尚未核实';

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        找联系方式
        {contacts.length > 0 && (
          <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[11px] text-primary">{contacts.length}</span>
        )}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Search className="size-4" />
          找联系方式
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-7 px-2 text-xs">
          收起
        </Button>
      </div>

      {/* 已核实徽标 */}
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-[11px] text-muted-foreground">
        <ShieldCheck className={entity.contactCheckedAt ? 'size-3.5 text-emerald-500' : 'size-3.5 text-muted-foreground'} />
        {checkedLabel}
      </div>

      {/* ── 已录入联系方式 ── */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs font-semibold text-muted-foreground">已录入联系方式</p>
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground/70">暂无。用下方搜索入口找到后录入。</p>
        ) : (
          <ul className="space-y-1">
            {contacts.map((c, i) => (
              <li key={i} className="flex items-center gap-2 rounded border bg-background px-2 py-1 text-xs">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium">{channelLabel(c.channel)}</span>
                <span className="flex-1 break-all">{c.value}</span>
                {canEdit && (
                  <button
                    onClick={() => removeContact(i)}
                    disabled={update.isPending}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                    title="删除"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* 录入表单（仅可编辑用户） */}
        {canEdit && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={draftChannel} onValueChange={setDraftChannel}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addContact(); }}
              placeholder="粘贴邮箱 / 微信 / 主页链接…"
              className="h-8 flex-1 text-xs"
            />
            <Button size="sm" className="h-8" onClick={addContact} disabled={update.isPending}>
              <Plus className="size-3.5" />
              添加
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={markChecked} disabled={update.isPending} title="不改内容，仅更新核实人和时间">
              <ShieldCheck className="size-3.5" />
              标记已查过
            </Button>
          </div>
        )}
      </div>

      {/* ── 搜索入口 ── */}
      <div className="mb-2 flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">搜索词：</span>
        <code className="rounded bg-background px-2 py-0.5 text-xs">{query}</code>
        <Button variant="ghost" size="sm" onClick={copyQuery} className="h-6 px-1.5 text-xs">
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? '已复制' : '复制'}
        </Button>
        {region && (
          <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={withRegion} onChange={(e) => setWithRegion(e.target.checked)} className="size-3.5 accent-primary" />
            叠加地区「{region}」
          </label>
        )}
      </div>

      {/* Google 精准 dork */}
      <div className="mb-2 flex flex-wrap gap-2">
        {DORKS.map((d) => (
          <a
            key={d.label}
            href={`https://www.google.com/search?q=${encodeURIComponent(d.q(name))}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
          >
            <d.icon className="size-3.5" />
            {d.label}
          </a>
        ))}
      </div>

      {/* 优先平台（按类型/地区） */}
      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">优先平台（按对象类型）</p>
      <div className="mb-2 flex flex-wrap gap-2">
        {groups.primary.map((t) => (
          <PlatformLink key={t.label} t={t} q={query} />
        ))}
      </div>

      {/* 其他平台 */}
      {groups.more.length > 0 && (
        <>
          <p className="mb-1 text-[11px] font-semibold text-muted-foreground">其他</p>
          <div className="flex flex-wrap gap-2">
            {groups.more.map((t) => (
              <PlatformLink key={t.label} t={t} q={query} />
            ))}
          </div>
        </>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        说明：系统按对象类型/地区推荐搜索入口，点开后人工核对真实账号；核实到的联系方式录入后会保存并标记核实人，多人可见、可在建联看板导出。
      </p>
    </div>
  );
}

function PlatformLink({ t, q }: { t: SearchTarget; q: string }) {
  return (
    <a
      href={t.url(q)}
      target="_blank"
      rel="noreferrer"
      title={t.hint}
      className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
    >
      {t.label}
      <ExternalLink className="size-3" />
    </a>
  );
}
