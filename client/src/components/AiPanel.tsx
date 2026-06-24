import { Component, useEffect, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEntitySummary } from '@/hooks/useAi';
import { toast } from 'sonner';

interface AiPanelProps {
  entityId: string;
}

/** 渲染 AI 文本时的兜底：任何渲染异常都显示提示，绝不让整页白屏 */
class MarkdownBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return <p className="text-sm text-muted-foreground">（AI 内容格式渲染失败，可点「重新生成」重试）</p>;
    }
    return this.props.children;
  }
}

/**
 * AI 总结面板（自包含）。
 * - 触发：点「✨ AI 总结」调用后端 /api/ai/summary/entity/:id
 * - 展示：Markdown 正文（react-markdown）+ token 用量
 * - 状态：loading / error（含重试）
 */
export default function AiPanel({ entityId }: AiPanelProps) {
  const summary = useEntitySummary();
  const [shown, setShown] = useState(false);

  // 切换对象时重置：避免显示上一个对象的旧总结
  useEffect(() => {
    setShown(false);
    summary.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  const handleGenerate = () => {
    setShown(true);
    summary.mutate(entityId, {
      onError: () => toast.error('AI 总结失败，请稍后重试'),
    });
  };

  const result = summary.data;
  const loading = summary.isPending;
  const error = summary.isError;

  // 收起后回到初始态
  if (!shown) {
    return (
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
        <Sparkles className="size-4" />
        AI 总结
      </Button>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Sparkles className="size-4" />
          AI 采购分析
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleGenerate}
          disabled={loading}
          className="h-7 px-2 text-xs"
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          {loading ? '生成中…' : '重新生成'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          正在分析数据并生成建议，模型带思考，可能需 10~30 秒…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 py-4 text-sm text-destructive">
          <AlertCircle className="size-4" />
          生成失败，请重试。
        </div>
      )}

      {!loading && !error && result && (
        <div className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0">
          <MarkdownBoundary>
            <ReactMarkdown>{result.content}</ReactMarkdown>
          </MarkdownBoundary>
          <p className="mt-3 text-[11px] text-muted-foreground">
            模型：{result.model}
            {result.usage?.output_tokens ? ` · 输出 ${result.usage.output_tokens} tokens` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
