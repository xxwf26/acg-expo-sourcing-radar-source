/** 名称归一化：候选/对象跨块、跨表去重比对的统一口径。
 *  extractor 与 crawl.service 共用，避免口径不一致导致漏判重复。 */
export function normalizeName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\s\-_.|·•,，、@]/g, '')
    .trim();
}
