import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCrawlMutations } from '@/hooks/useCrawl';
import { useEvents } from '@/hooks/useRadarData';
import { sourceApi } from '@/api/source';
import { crawlApi } from '@/api/crawl';

const NO_EVENT = '__none__';

/**
 * 手动录入名单 → 抽取候选。针对自动抓不到的展会（网络不通 / 需登录·交互·付费）。
 * 两种方式：
 *  - 粘贴名单文本（主）：用户自己复制页面名单贴进来，系统只做 AI 抽取，彻底绕开抓取难题。
 *  - 粘贴链接：能被系统抓到的一次性页面，存为信息源并立即抓取（复用现有抓取管线）。
 * 候选统一进「候选复核」队列，复用去重/打分/转正流程。
 */
export default function ManualIngestModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data: eventsResp } = useEvents();
  const events = eventsResp?.list || [];
  const { extractText } = useCrawlMutations();
  const qc = useQueryClient();

  // 贴文本
  const [rawText, setRawText] = useState('');
  const [textName, setTextName] = useState('');
  const [textEventId, setTextEventId] = useState<string>(NO_EVENT);

  // 贴链接
  const [url, setUrl] = useState('');
  const [strategy, setStrategy] = useState('static');
  const [linkName, setLinkName] = useState('');
  const [linkEventId, setLinkEventId] = useState<string>(NO_EVENT);
  const [linkSubmitting, setLinkSubmitting] = useState(false);

  const reset = () => {
    setRawText('');
    setTextName('');
    setTextEventId(NO_EVENT);
    setUrl('');
    setStrategy('static');
    setLinkName('');
    setLinkEventId(NO_EVENT);
  };

  const submitText = () => {
    if (rawText.trim().length < 20) {
      toast.error('粘贴内容过少（至少 20 字）');
      return;
    }
    extractText.mutate(
      {
        rawText,
        name: textName.trim() || undefined,
        eventId: textEventId === NO_EVENT ? undefined : textEventId,
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      },
    );
  };

  // 贴链接：存为信息源（enabled）→ 立即抓取。复用现有 source CRUD + crawl.run。
  const submitLink = async () => {
    const u = url.trim();
    if (!/^https?:\/\//i.test(u)) {
      toast.error('请填写 http/https 开头的完整链接');
      return;
    }
    setLinkSubmitting(true);
    try {
      const src = await sourceApi.create({
        name: linkName.trim() || u.slice(0, 80),
        url: u,
        strategy,
        eventId: linkEventId === NO_EVENT ? undefined : linkEventId,
        enabled: true,
      });
      await crawlApi.run(src.id);
      toast.success('已存为信息源并开始抓取，进度见「抓取历史」');
      qc.invalidateQueries({ queryKey: ['sources'] });
      qc.invalidateQueries({ queryKey: ['crawl-runs'] });
      reset();
      onOpenChange(false);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || '存为信息源或抓取触发失败');
    } finally {
      setLinkSubmitting(false);
    }
  };

  const EventSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9">
        <SelectValue placeholder="归属展会（可选）" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_EVENT}>不指定展会</SelectItem>
        {events.map((ev) => (
          <SelectItem key={ev.id} value={ev.id}>
            {ev.short || ev.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">手动录入名单</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">粘贴名单文本</TabsTrigger>
            <TabsTrigger value="link">粘贴链接</TabsTrigger>
          </TabsList>

          {/* ── 贴文本（主）── */}
          <TabsContent value="text" className="space-y-3 pt-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              打不开 / 抓不到的页面（需登录、要交互、境外站连不上等），
              自己在浏览器打开后复制名单，粘贴到这里即可。系统会用 AI 抽成候选，进入复核队列。
            </p>
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={9}
              placeholder={'把名单文本粘贴到这里，例如：\nA35  KADOKAWA\nJ48  葦プロダクション\n…（名字 + 展位号，一行一条最佳）'}
              className="font-mono text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={textName}
                onChange={(e) => setTextName(e.target.value)}
                placeholder="来源名称（可选，如 AX官网名单）"
                className="h-9"
              />
              <EventSelect value={textEventId} onChange={setTextEventId} />
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" disabled={extractText.isPending} onClick={submitText}>
                {extractText.isPending ? '提交中…' : '开始抽取'}
              </Button>
            </div>
          </TabsContent>

          {/* ── 贴链接 ── */}
          <TabsContent value="link" className="space-y-3 pt-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              适合能被系统抓到的公开名单页。会存为一条信息源并立即抓取——
              以后也可在「信息源监控」里重复抓取。抓不通/需交互的站请改用左边「粘贴名单文本」。
            </p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https:// 名单页链接"
              className="h-9"
            />
            <div className="grid grid-cols-2 gap-2">
              <Select value={strategy} onValueChange={setStrategy}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">static（纯 HTML，最快）</SelectItem>
                  <SelectItem value="browser">browser（JS 渲染页）</SelectItem>
                  <SelectItem value="pdf">pdf（PDF 名单）</SelectItem>
                </SelectContent>
              </Select>
              <EventSelect value={linkEventId} onChange={setLinkEventId} />
            </div>
            <Input
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="信息源名称（可选）"
              className="h-9"
            />
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" disabled={linkSubmitting} onClick={submitLink}>
                {linkSubmitting ? '提交中…' : '存为信息源并抓取'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
