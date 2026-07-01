import { load } from 'cheerio';
import { renderPage } from './browser';

export interface FetchResult {
  /** 清洗后的纯文本（去脚本/样式，压缩空白），喂给 LLM 的原料 */
  text: string;
  /** 原始字节数，便于诊断 */
  bytes: number;
  /** 实际使用的抓取策略 */
  strategy: string;
}

/**
 * 抓取层。支持三种策略：
 * - static：纯 HTML（fetch + cheerio），最快，适合服务端渲染的名单页
 * - browser：无头浏览器（playwright），抓 JS 动态渲染页（如 AX / gamescom）
 * - pdf：下载 PDF 名单并抽文本（pdf-parse）
 *
 * 设计原则：抓取层只负责拿到「干净文本」，不做信息抽取——抽取交给 LLM。
 * 这样官网改版导致抽取出错时，可只重跑抽取、不必重抓。
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
    // renderPage 返回渲染后的可见纯文本（innerText），无需再走 htmlToText 挑标签
    const raw = await renderPage(opts.url, opts.selector);
    const text = cleanText(raw);
    return { text, bytes: Buffer.byteLength(raw, 'utf8'), strategy };
  }
  // 默认 static
  return fetchStatic(opts.url, opts.selector);
}

/** 静态抓取：fetch 原始 HTML */
async function fetchStatic(url: string, selector?: string | null): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // 合规 UA，标明来源，便于站方识别；只抓公开页
        'User-Agent': 'Mozilla/5.0 (compatible; ACGSourcingRadar/1.0; +internal sourcing tool)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    html = await res.text();
  } finally {
    clearTimeout(timer);
  }
  const bytes = Buffer.byteLength(html, 'utf8');
  return { text: htmlToText(html, selector), bytes, strategy: 'static' };
}

/** PDF 名单：下载 → pdf-parse 抽文本 */
async function fetchPdf(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  let buf: Buffer;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ACGSourcingRadar/1.0; +internal sourcing tool)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    buf = Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
  // pdf-parse v2：new PDFParse({ data }).getText()
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buf });
  try {
    const result = await parser.getText();
    return { text: cleanText(result.text || ''), bytes: buf.length, strategy: 'pdf' };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

/** 纯文本清洗：逐行 trim、丢空行、去连续重复行（导航/页脚常重复）。用于 browser/pdf 结果 */
export function cleanText(raw: string): string {
  const seen = new Set<string>();
  return raw
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
  // 表格行优先按 | 拼接，保留「画师名 | 桌号」这类对应关系
  scope.find('tr').each((_, tr) => {
    const cells = $(tr)
      .find('th, td')
      .map((__, c) => $(c).text().trim().replace(/\s+/g, ' '))
      .get()
      .filter(Boolean);
    if (cells.length) lines.push(cells.join(' | '));
  });

  // 非表格正文（列表/段落）
  scope.find('li, p, h1, h2, h3, h4').each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, ' ');
    if (t) lines.push(t);
  });

  let text = lines.join('\n');
  // 兜底：若上面没抓到结构化内容，退化为整段文本
  if (text.trim().length < 50) {
    text = scope.text().replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  }
  // 去重连续重复行（导航/页脚常重复）
  const seen = new Set<string>();
  const deduped = text
    .split('\n')
    .filter((l) => {
      const k = l.trim();
      if (!k) return false;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join('\n');
  return deduped;
}
