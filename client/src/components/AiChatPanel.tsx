import { Component, useRef, useState, type ReactNode, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Send, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAiChat } from '@/hooks/useAi';
import { toast } from 'sonner';
import type { IAiChatMessage } from '@/api/ai';

/** 兜底：AI 文本渲染异常时显示提示，不让整页白屏 */
class MarkdownBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error) {
      return <p className="text-xs text-muted-foreground">（内容渲染失败，可清空重试）</p>;
    }
    return this.props.children;
  }
}

/**
 * 全局 AI 聊天助手（带全库快照，可多轮）。
 * 放在建联对象右侧面板「本周建议动作」上方。
 * 历史维护在组件本地；每次发送把历史 + 当前消息一起发给后端。
 */
export default function AiChatPanel() {
  const [messages, setMessages] = useState<IAiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const chat = useAiChat();
  const scrollRef = useRef<HTMLDivElement>(null);

  const send = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || chat.isPending) return;

    const nextHistory: IAiChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextHistory);
    setInput('');

    chat.mutate(
      { message: text, history: messages },
      {
        onSuccess: (res) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: res.content }]);
          // 滚到底
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 50);
        },
        onError: () => toast.error('AI 回复失败，请稍后重试'),
      },
    );
  };

  const clear = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
          <Sparkles className="size-4" />
          AI 全库助手
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-7 px-2 text-xs">
            <Trash2 className="size-3.5" />
            清空
          </Button>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[300px] min-h-[80px] overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">
            已加载全库快照。可问：「总结当前雷达现状并给出本周建议」「哪些 S 级对象还没建联？」「AX 2026 重点对象有哪些」。
          </p>
        ) : (
          <div className="space-y-2.5">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[85%] rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground'
                      : 'max-w-[90%] rounded-lg bg-muted px-2.5 py-1.5 text-xs'
                  }
                >
                  {m.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  ) : (
                    <div className="prose prose-sm max-w-none text-foreground [&>*:first-child]:mt-0">
                      <MarkdownBoundary>
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </MarkdownBoundary>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  分析全库生成回复中…（模型带思考，可能 10~40 秒）
                </div>
              </div>
            )}
            {chat.isError && !chat.isPending && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" />
                回复失败，可重试或清空。
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={send} className="mt-2 flex items-center gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问全库现状 / 要建议…"
          disabled={chat.isPending}
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" disabled={chat.isPending || !input.trim()} className="h-8 px-2">
          {chat.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
