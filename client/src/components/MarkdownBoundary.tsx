import { Component, type ReactNode } from 'react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * 渲染 AI Markdown 文本时的兜底边界：任何渲染异常都显示 fallback，
 * 绝不让整页白屏。三个 AI 面板共用。
 */
export default class MarkdownBoundary extends Component<Props, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[MarkdownBoundary] 渲染失败', error);
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <p className="text-xs text-muted-foreground">（内容渲染失败，可重试或重新生成）</p>
        )
      );
    }
    return this.props.children;
  }
}
