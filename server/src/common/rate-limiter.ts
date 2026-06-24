import { Injectable } from '@nestjs/common';

/**
 * 轻量内存限流器（滑动窗口），按 key 统计。
 * 用于 AI 接口、登录等防滥用；进程内有效，重启清零，足够单机部署用。
 */
@Injectable()
export class RateLimiter {
  private hits = new Map<string, number[]>();

  /** 返回 true 表示允许，false 表示超限 */
  consume(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const arr = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      this.hits.set(key, arr);
      return false;
    }
    arr.push(now);
    this.hits.set(key, arr);
    return true;
  }
}
