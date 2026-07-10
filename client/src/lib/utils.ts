import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 从 axios 错误里提取后端 message（引用保护/校验失败等），取不到则用 fallback */
export function getErrMsg(e: unknown, fallback: string): string {
  const err = e as { response?: { data?: { message?: string } } };
  return err?.response?.data?.message || fallback;
}

/**
 * 后端时间统一为北京时间。但 DATETIME 经 drizzle/JS Date 序列化成 JSON 后会带 "Z"（UTC 标记），
 * 例如库里北京时间 15:04 序列化成 "2026-07-10T15:04:01.000Z"——数字对、标签错。
 * 若直接 new Date() 解析，浏览器会按 UTC 再 +8 显示成 23:04（偏移，"像美国时间"）。
 *
 * 解决：按 UTC 读取这串数字（getUTC*），不做任何时区偏移——得到的就是正确的北京时间。
 * 且不依赖浏览器所在时区，任何机器上显示一致。
 */
function parseBeijing(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** 格式化为「M/D HH:mm」（北京时间）。用于抓取历史等紧凑展示。 */
export function fmtBeijingShort(ts: string | null | undefined): string {
  const d = parseBeijing(ts);
  if (!d) return ts || '';
  const M = d.getUTCMonth() + 1;
  const D = d.getUTCDate();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${M}/${D} ${h}:${m}`;
}

/** 格式化为「YYYY/MM/DD HH:mm:ss」（北京时间）。用于完整时间展示。 */
export function fmtBeijingFull(ts: string | null | undefined): string {
  const d = parseBeijing(ts);
  if (!d) return ts || '';
  const Y = d.getUTCFullYear();
  const M = String(d.getUTCMonth() + 1).padStart(2, '0');
  const D = String(d.getUTCDate()).padStart(2, '0');
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  return `${Y}/${M}/${D} ${h}:${m}:${s}`;
}
