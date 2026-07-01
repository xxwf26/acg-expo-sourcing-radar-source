// 建联对象视图右侧固定面板（移植原 index.html side-stack 内容）
// 注：「本周建议动作」面板按会议纪要要求已移除，AiWeeklyActionsPanel 组件保留备用。

const SCORING_NOTES = [
  '只收录营销采购窗口：大佬、艺术家、画师、KOL/KOC、线下搭建、展陈、周边、推广执行供应商。',
  '不收录 PR/发行/IT/艺人演出窗口：友商游戏 IP 展台、支付、发行、买量广告技术、硬件设备、女团/男团舞台等。',
  '建联可行性：是否有官网 contact、shop、wholesale、agent 或现场 booth。',
  '采购可复用性：是否能服务多个项目，而不是一次性情报观察。',
];

function Panel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold">{title}</h2>
      <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function EntitySidePanel() {
  return (
    <aside className="space-y-4">
      <Panel title="推荐评分口径" items={SCORING_NOTES} />
    </aside>
  );
}
