import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

/**
 * 大模型调用客户端。
 * 接的是「走 Anthropic Messages 协议的中转」，用 @anthropic-ai/sdk + baseURL。
 * 模型 deepseek-v4-pro 默认会产出 thinking 块，本客户端只拼接 text 块。
 */
@Injectable()
export class LlmClient implements OnModuleInit {
  private client!: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly timeout: number;

  constructor(private readonly cfg: ConfigService) {
    this.model = this.cfg.get<string>('AI_MODEL') || 'deepseek-v4-pro';
    // thinking 块与 text 块共享 max_tokens 配额，需给足，否则正文被思考吃光
    this.maxTokens = Number(this.cfg.get<string>('AI_MAX_TOKENS') || 8000);
    this.timeout = Number(this.cfg.get<string>('AI_TIMEOUT_MS') || 90000);
  }

  onModuleInit() {
    const apiKey = this.cfg.get<string>('AI_API_KEY');
    const baseURL = this.cfg.get<string>('AI_BASE_URL');
    if (!apiKey) {
      // 不抛异常阻断启动：AI 是增强功能，缺 Key 时其它接口照常工作，调用时再报错。
      // eslint-disable-next-line no-console
      console.warn('[AiModule] AI_API_KEY 未配置，AI 接口将不可用');
      return;
    }
    this.client = new Anthropic({ apiKey, baseURL, timeout: this.timeout });
  }

  get available(): boolean {
    return !!this.client;
  }

  /** 非流式调用：返回拼接后的正文 + 用量。丢弃 thinking 块。瞬时错误自动重试。
   *  maxTokens 可选覆盖（抽取长名单时需给足，否则 thinking 会吃光默认额度导致正文为空）。 */
  async chat(
    system: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens?: number,
  ): Promise<{ content: string; model: string; usage: Record<string, number> }> {
    if (!this.client) {
      throw new Error('AI 服务未配置（缺少 AI_API_KEY）');
    }
    const res = await this.callWithRetry(() =>
      this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens ?? this.maxTokens,
        system,
        messages,
      }),
    );
    const text = (res.content ?? [])
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) {
      // thinking 吃满配额或模型未产正文：不能当成功返回空串
      throw new Error('AI 未返回正文（可能思考耗尽 max_tokens，请调大 AI_MAX_TOKENS 或重试）');
    }
    return { content: text, model: res.model, usage: res.usage as unknown as Record<string, number> };
  }

  /** 对瞬时错误（429/超时/5xx/连接错误）做 2 次指数退避重试 */
  private async callWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    const maxAttempts = 3;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        lastErr = err;
        const status = err?.status ?? err?.response?.status;
        const retryable =
          status === 429 ||
          (typeof status === 'number' && status >= 500) ||
          err?.name === 'APIConnectionError' ||
          err?.name === 'APITimeoutError' ||
          err?.code === 'ETIMEDOUT';
        if (!retryable || attempt === maxAttempts) throw err;
        // 退避：500ms, 1500ms
        await new Promise((r) => setTimeout(r, 500 * Math.pow(3, attempt - 1)));
      }
    }
    throw lastErr;
  }
}
