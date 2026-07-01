import { useState } from 'react';
import { Search, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ContactFinderProps {
  name: string;
  region?: string;
}

/** 一个搜索入口：平台名 + 构造好的直达搜索 URL */
interface SearchTarget {
  label: string;
  hint?: string;
  url: (q: string) => string;
}

// 各平台直达搜索链接构造器。不调任何付费 API，纯拼 URL，人点开自己看。
const TARGETS: SearchTarget[] = [
  { label: 'Google', hint: 'artist / illustrator', url: (q) => `https://www.google.com/search?q=${encodeURIComponent(`${q} artist illustrator`)}` },
  { label: 'X / Twitter', url: (q) => `https://x.com/search?q=${encodeURIComponent(q)}&f=user` },
  { label: 'Instagram', url: (q) => `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(q)}` },
  { label: 'pixiv', hint: '日系画师常驻', url: (q) => `https://www.pixiv.net/tags/${encodeURIComponent(q)}/artworks` },
  { label: 'ArtStation', hint: '欧美美术供应商', url: (q) => `https://www.artstation.com/search?query=${encodeURIComponent(q)}` },
  { label: '微博', url: (q) => `https://s.weibo.com/user?q=${encodeURIComponent(q)}` },
  { label: 'Bilibili', url: (q) => `https://search.bilibili.com/upuser?keyword=${encodeURIComponent(q)}` },
  { label: '小红书', url: (q) => `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}` },
];

/**
 * 半自动找联系方式（P0 方案）。
 * 当前 LLM 中转不带联网能力，无法真正抓取联系方式；这里退而求其次：
 * 用对象名（可叠加地区）构造各社媒/作品平台的直达搜索链接，人工点开核对。
 * 零外部 API、零成本，立刻可用；后续若接入 Web 搜索 API 再升级为真·自动搜索。
 */
export default function ContactFinder({ name, region }: ContactFinderProps) {
  const [open, setOpen] = useState(false);
  // 默认查询词用名称；地区作为可叠加的辅助词（部分平台叠地区反而搜不到，故默认只用名称）
  const [withRegion, setWithRegion] = useState(false);
  const [copied, setCopied] = useState(false);

  const query = withRegion && region ? `${name} ${region}` : name;

  const copyQuery = async () => {
    try {
      await navigator.clipboard.writeText(query);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请手动选择');
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Search className="size-4" />
        找联系方式
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Search className="size-4" />
          半自动找联系方式
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-7 px-2 text-xs">
          收起
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">搜索词：</span>
        <code className="rounded bg-background px-2 py-0.5 text-xs">{query}</code>
        <Button variant="ghost" size="sm" onClick={copyQuery} className="h-6 px-1.5 text-xs">
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? '已复制' : '复制'}
        </Button>
        {region && (
          <label className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={withRegion}
              onChange={(e) => setWithRegion(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            叠加地区「{region}」
          </label>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {TARGETS.map((t) => (
          <a
            key={t.label}
            href={t.url(query)}
            target="_blank"
            rel="noreferrer"
            title={t.hint}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs text-info hover:bg-accent"
          >
            {t.label}
            <ExternalLink className="size-3" />
          </a>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        说明：当前为半自动模式——系统按名称构造各平台搜索入口，点开后人工核对真实账号与联系方式。
        部分平台（如 X / Instagram）可能需登录后才显示完整结果。
      </p>
    </div>
  );
}
