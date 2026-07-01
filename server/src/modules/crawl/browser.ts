import type { Browser } from 'playwright';

/**
 * 无头浏览器单例管理（P2）。
 * - 全进程复用一个 chromium 实例，避免每次抓取都冷启动（省几百 ms + 内存）。
 * - 懒加载：只有真正用到 browser 策略时才启动，static/pdf 源不受影响。
 * - 每次抓取用独立 context（隔离 cookie/存储），抓完即关。
 */
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    // 动态 import，避免未装 chromium 时拖累整个模块加载
    browserPromise = import('playwright').then(({ chromium }) =>
      chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      }),
    );
  }
  return browserPromise;
}

/**
 * 用无头浏览器打开页面、等渲染完成，返回**渲染后的可见纯文本**（body.innerText）。
 *
 * 关键经验（AX 名单页踩坑）：
 * - 很多展会站有持续的广告/分析请求，networkidle 永不触发 → 必须用 domcontentloaded。
 * - 名单常由插件异步渲染成卡片/div（未必是 <table>），死等固定标签会落空 →
 *   轮询 body 文本长度直到稳定，再取 innerText，比等某个选择器更鲁棒。
 * - 直接取 innerText 得到的是「所见即所得」的纯文本，绕开各站五花八门的 DOM 结构。
 *
 * @param url        目标地址
 * @param waitFor    可选：额外等待某个 CSS 选择器出现（若你确知名单容器）
 * @param timeoutMs  goto 超时
 */
export async function renderPage(
  url: string,
  waitFor?: string | null,
  timeoutMs = 30000,
): Promise<string> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; ACGSourcingRadar/1.0; +internal sourcing tool)',
    viewport: { width: 1280, height: 2000 },
  });
  const page = await context.newPage();
  // 拦截图片/字体/媒体，加速渲染
  await page.route('**/*', (route) => {
    const t = route.request().resourceType();
    if (t === 'image' || t === 'font' || t === 'media') return route.abort();
    return route.continue();
  });

  try {
    // 用 domcontentloaded：不少展会站持续有后台请求，networkidle 会超时
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    if (waitFor && waitFor.trim()) {
      await page.waitForSelector(waitFor, { timeout: 12000 }).catch(() => {});
    }

    // 轮询 body 文本长度直到稳定（异步渲染的名单会让文本持续变长）
    let prev = 0;
    let stable = 0;
    for (let i = 0; i < 12; i++) {
      const len = await page.evaluate(
        // document 在浏览器上下文求值，tsc 按 Node 库检查会报错，故用字符串形式
        'document.body ? document.body.innerText.length : 0',
      ) as number;
      if (len > 0 && len === prev) {
        stable += 1;
        if (stable >= 2) break; // 连续两次不变即认为渲染完成
      } else {
        stable = 0;
      }
      prev = len;
      await page.waitForTimeout(1200);
    }

    return (await page.evaluate('document.body ? document.body.innerText : ""')) as string;
  } finally {
    await context.close().catch(() => {});
  }
}

/** 进程退出时关闭浏览器（NestJS onModuleDestroy 会调用） */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}
