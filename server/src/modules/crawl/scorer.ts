import { LlmClient } from '../ai/llm.client';

export interface SourcingConfigData {
  modules?: string[] | null;
  benchmarks?: string[] | null;
  scoringRubric?: string | null;
}

/** 待打分的候选（只喂打分需要的字段，省 token） */
export interface ScorableCandidate {
  id: string;
  name: string;
  type: string;
  region?: string | null;
  booth?: string | null;
  reason?: string | null;
}

export interface ScoreResult {
  id: string;
  score: number; // 0-100
  reason: string; // 一句话推荐/匹配理由
}

function buildSystem(cfg: SourcingConfigData): string {
  const modules = (cfg.modules ?? []).filter(Boolean);
  const benchmarks = (cfg.benchmarks ?? []).filter(Boolean);
  return `你是 ACG 营销采购寻源助手。任务：根据本公司的采购画像，为每个候选对象打「匹配度分」(0-100) 并给一句话理由。

## 本公司采购画像（打分依据）
- 采购模块（我们要找的类型）：${modules.length ? modules.join('、') : '（未指定，按通用 ACG 采购判断）'}
- 对标公司/IP（风格/量级参照）：${benchmarks.length ? benchmarks.join('、') : '（未指定）'}
- 额外口径：${cfg.scoringRubric?.trim() || '（无）'}

## 打分标准
- 90-100：高度契合采购模块、可直接推进建联的优先对象
- 70-89：契合、值得联系
- 50-69：一般相关、可备选
- 0-49：弱相关或不符合采购窗口
- 只依据给定信息判断，信息不足时给中性分并在理由中说明"资料不足"。

## 输出格式
只输出 JSON 数组，不要解释、不要代码围栏，每个候选一项，顺序不限：
[{"id":"候选id原样","score":85,"reason":"一句话理由"}]`;
}

/**
 * 批量给候选打匹配分。分批调用（每批 ~15 个），避免单次输出过长被 thinking/max_tokens 截断。
 * 单批失败跳过（不拖垮整体），返回所有成功打分的结果。
 */
export async function scoreCandidates(
  llm: LlmClient,
  cfg: SourcingConfigData,
  candidates: ScorableCandidate[],
): Promise<ScoreResult[]> {
  const system = buildSystem(cfg);
  const out: ScoreResult[] = [];
  const BATCH = 15;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const payload = batch.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      region: c.region || '',
      booth: c.booth || '',
      note: c.reason || '',
    }));
    const userMsg = `给以下候选打分（逐个返回 id/score/reason）：\n${JSON.stringify(payload)}`;
    try {
      const res = await llm.chat(system, [{ role: 'user', content: userMsg }], 6000);
      for (const r of parseScores(res.content)) out.push(r);
    } catch {
      // 该批失败跳过
    }
  }
  return out;
}

/** 解析打分返回：容忍围栏/多余文本，提取 JSON 数组 */
export function parseScores(content: string): ScoreResult[] {
  if (!content) return [];
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  let arr: unknown;
  try {
    arr = JSON.parse(content.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: ScoreResult[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id : '';
    let score = typeof o.score === 'number' ? o.score : Number(o.score);
    if (!id || Number.isNaN(score)) continue;
    score = Math.max(0, Math.min(100, Math.round(score)));
    out.push({ id, score, reason: typeof o.reason === 'string' ? o.reason.trim() : '' });
  }
  return out;
}
