import { load } from 'cheerio';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { renderPage } from './browser';

export interface FetchResult {
  /** 清洗后的纯文本（去脚本/样式，压缩空白），喂给 LLM 的原料 */
  text: string;
  /** 原始字节数，便于诊断 */
  bytes: number;
  /** 实际使用的抓取策略 */
  strategy: string;
}

const MAX_HTML_BYTES = 20 * 1024 * 1024; // 20MB
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 30000;
const UA = 'Mozilla/5.0 (compatible; ACGSourcingRadar/1.0; +internal sourcing tool)';

/** 私网/回环/链路本地/元数据 IP 判定 → 拒绝（防 SSRF） */
function isPrivateIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // 链路本地 + 云元数据 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (v === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.split(':').pop();
      if (v4 && isPrivateIp(v4)) return true; // IPv4-mapped
    }
    return false;
  }
  return false;
}

/** SSRF 校验：仅 http/https、拒绝内网/回环/链路本地主机（含 DNS 解析后的地址） */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('抓取 URL 非法（无法解析）');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('仅允许 http/https');
  }
  const host = u.hostname;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === 'metadata.google.internal') {
    throw new Error('禁止抓取内网/本地地址');
  }
  const entries = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!entries.length) throw new Error(`无法解析主机：${host}`);
  for (const e of entries) {
    if (isPrivateIp(e.address)) {
      throw new Error(`禁止抓取内网地址（${host} → ${e.address}）`);
    }
  }
  return u;
}

/** 对瞬时错误（429/5xx/超时）做 1 次重试 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const status = e?.message ? Number((e.message.match(/HTTP (\d{3})/) || [])[1]) : 0;
    const retryable = status === 429 || (status >= 500 && status <= 599) || e?.name === 'AbortError' || e?.code === 'ETIMEDOUT';
    if (!retryable) throw e;
    await new Promise((r) => setTimeout(r, 1000));
    return fn();
  }
}

/** 安全抓取：手动跟随重定向（每跳 SSRF 复查）+ 体积上限，防 OOM 与内网穿透 */
async function safeFetch(url: string, maxBytes: number, accept: string): Promise<{ buf: Buffer; contentType: string }> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': UA, Accept: accept },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) throw new Error('重定向无 Location');
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const len = Number(res.headers.get('content-length') || 0);
      if (len && len > maxBytes) throw new Error(`响应过大（${len} 字节 > 上限 ${maxBytes}）`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('无响应体');
      const chunks: Buffer[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) throw new Error(`响应过大（> ${maxBytes} 字节）`);
        chunks.push(Buffer.from(value));
      }
      return { buf: Buffer.concat(chunks), contentType: res.headers.get('content-type') || '' };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('重定向次数过多');
}

/**
 * 抓取层。支持三种策略：
 * - static：纯 HTML（fetch + cheerio），最快，适合服务端渲染的名单页
 * - browser：无头浏览器（playwright），抓 JS 动态渲染页（如 AX / gamescom）
 * - pdf：下载 PDF 名单并抽文本（pdf-parse）
 *
 * 设计原则：抓取层只负责拿到「干净文本」，不做信息抽取——抽取交给 LLM。
 * 安全：所有策略前都做 SSRF 校验，禁止抓取内网/回环/元数据地址。
 */
export async function fetchSource(opts: {
  url: string;
  strategy?: string | null;
  selector?: string | null;
}): Promise<FetchResult> {
  const strategy = opts.strategy || 'static';
  if (!opts.url || !/^https?:\/\//i.test(opts.url)) {
    throw new Error('抓取 URL 非法（需 http/https 绝对地址）');
  }

  if (strategy === 'pdf') {
    return fetchPdf(opts.url);
  }
  if (strategy === 'browser') {
    await assertSafeUrl(opts.url); // playwright 抓取前同样 SSRF 校验
    const raw = await renderPage(opts.url, opts.selector);
    const text = cleanText(raw);
    return { text, bytes: Buffer.byteLength(raw, 'utf8'), strategy };
  }
  return fetchStatic(opts.url, opts.selector);
}

/** 静态抓取：fetch 原始 HTML */
async function fetchStatic(url: string, selector?: string | null): Promise<FetchResult> {
  const { buf } = await withRetry(() => safeFetch(url, MAX_HTML_BYTES, 'text/html,application/xhtml+xml'));
  const html = buf.toString('utf8');
  return { text: htmlToText(html, selector), bytes: buf.length, strategy: 'static' };
}

/** PDF 名单：下载 → pdf-parse 抽文本 */
async function fetchPdf(url: string): Promise<FetchResult> {
  const { buf } = await withRetry(() => safeFetch(url, MAX_PDF_BYTES, 'application/pdf'));
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return { text: cleanText(result.text || ''), bytes: buf.length, strategy: 'pdf' };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** 逐行去重（导航/页脚常重复） */
function dedupLines(text: string): string {
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false;
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .join('\n');
}

/** 纯文本清洗：逐行 trim、丢空行、去连续重复行。用于 browser/pdf 结果 */
export function cleanText(raw: string): string {
  return dedupLines(raw);
}

/**
 * HTML → 纯文本。
 * - 去掉 script/style/noscript/svg
 * - 若给了 selector，则只取该范围（缩小喂给 LLM 的正文，控 token）
 * - 表格按行拼成「单元格1 | 单元格2」，保留名单的结构信息
 * - 压缩多余空白
 */
export function htmlToText(html: string, selector?: string | null): string {
  const $ = load(html);
  $('script, style, noscript, svg, iframe').remove();

  const root = selector && selector.trim() ? $(selector) : $('body');
  const scope = root.length ? root : $('body');

  const lines: string[] = [];
  scope.find('tr').each((_, tr) => {
    const cells = $(tr)
      .find('th, td')
      .map((__, c) => $(c).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter(Boolean);
    if (cells.length) lines.push(cells.join(' | '));
  });
  scope.find('li, p, h1, h2, h3, h4').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t) lines.push(t);
  });

  let text = lines.join('\n');
  if (text.trim().length < 50) {
    text = scope.text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  return dedupLines(text);
}
