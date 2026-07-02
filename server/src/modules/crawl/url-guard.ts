import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF 防护：抓取层会请求「用户配置的任意 URL」，若不校验目标，攻击者可让服务器
 * 请求内网 / localhost / 云元数据(169.254.169.254) 等，形成带回显的 SSRF。
 *
 * 校验策略：
 * - 仅允许 http/https（挡掉 file:// gopher:// 等）
 * - 解析 hostname 的所有 IP（含 DNS 解析），逐个拒绝私有 / 保留 / 环回 / 链路本地段
 * - 供抓取前 + 每一跳重定向后调用（防 DNS rebinding / 重定向绕过）
 */

/** 判断一个 IP 字面量是否落在私有 / 保留 / 环回 / 链路本地段 */
export function isBlockedIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
    const [a, b] = p;
    if (a === 10) return true; // 10/8
    if (a === 127) return true; // 127/8 环回
    if (a === 0) return true; // 0/8
    if (a === 169 && b === 254) return true; // 169.254/16 链路本地（含云元数据）
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
    if (a >= 224) return true; // 组播 / 保留
    return false;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === '::1' || s === '::') return true; // 环回 / 未指定
    if (s.startsWith('fe80')) return true; // 链路本地
    if (s.startsWith('fc') || s.startsWith('fd')) return true; // fc00::/7 唯一本地
    // IPv4 映射地址 ::ffff:a.b.c.d —— 取出内嵌 IPv4 再判
    const m = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (m) return isBlockedIp(m[1]);
    return false;
  }
  // 非法 IP 一律拦
  return true;
}

/**
 * 校验单个 URL 是否可安全抓取。不安全则抛错。
 * @param url 待校验地址
 */
export async function assertSafeUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('抓取 URL 非法（无法解析）');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`抓取 URL 协议不允许：${parsed.protocol}（仅 http/https）`);
  }
  const host = parsed.hostname;
  // hostname 本身就是 IP（含十进制/十六进制被 URL 归一为点分）→ 直接判
  if (isIP(host)) {
    if (isBlockedIp(host)) throw new Error(`抓取目标指向内网/保留地址，已拒绝：${host}`);
    return;
  }
  // 域名 → DNS 解析出所有 IP，任一落私有段即拒绝（防解析到内网 / DNS rebinding）
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new Error(`抓取目标域名无法解析：${host}`);
  }
  if (!addrs.length) throw new Error(`抓取目标域名无解析结果：${host}`);
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new Error(`抓取目标解析到内网/保留地址，已拒绝：${host} → ${address}`);
    }
  }
}

/**
 * 手动跟随重定向并对每一跳校验目标（防「外部合法 URL 302 跳内网」绕过）。
 * 返回最终响应；最多跟随 maxRedirects 跳。
 */
export async function safeFetch(
  url: string,
  init: RequestInit,
  maxRedirects = 5,
): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertSafeUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    // 3xx 且带 Location → 手动跟随并复校验
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('重定向次数过多');
}
