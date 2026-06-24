import { Component, useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWeeklyActions } from '@/hooks/useAi';
import { toast } from 'sonner';

const STORAGE_KEY = 'aiWeeklyActions.v1';

/** 渲染 AI 文本时的兜底，绝不让整页白屏 */
class MarkdownBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return <p className="text-xs text-muted-foreground">（内容渲染失败，可重新生成）</p>;
    }
    return this.props.children;
  }
}

function loadStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * 本周建议动作（AI 动态生成，按 数据判定/规范/AI建议 三类标注）。
 * 替换原写死的 WEEKLY_ACTIONS 面板。结果持久化到 localStorage，切视图不丢。
 */
export default function AiWeeklyActionsPanel() {
  const gen = useWeeklyActions();
  const [content, setContent] = useState<string | null>(loadStored());

  useEffect(() => {
    try {
      if (content) localStorage.setItem(STORAGE_KEY, content);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, [content]);

  const handleGenerate = () => {
    gen.mutate(undefined, {
      onSuccess: (res) => setContent(res.content),
      onError: () => toast.error('生成本周建议失败，请稍后重试'),
    });
  };

  const loading = gen.isPending;
  const error = gen.isError;

  if (!content && !loading && !error) {
    return (
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">本周建议动作</h2>
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
            <Sparkles className="size-4" />
            生成
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          点「生成」由 AI 基于当前数据库分析，按 数据判定 / 规范口径 / AI建议 三类给出本周动作。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">本周建议动作</h2>
        <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={loading} className="h-7 px-2 text-xs">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          {loading ? '生成中…' : '重新生成'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          分析全库生成本周建议中…（模型带思考，约 10~30 秒）
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 py-3 text-xs text-destructive">
          <AlertCircle className="size-4" />
          生成失败，请重试。
        </div>
      )}

      {!loading && !error && content && (
        <div className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0 [&>h3]:mt-3 [&>h3]:text-xs [&>h3]:font-bold [&>ul]:mt-1 [&>ul]:space-y-1 [&>ul]:text-xs [&>ul]:text-muted-foreground">
          <MarkdownBoundary>
            <ReactMarkdown>{content}</ReactMarkdown>
          </MarkdownBoundary>
        </div>
      )}
    </div>
  );
}
