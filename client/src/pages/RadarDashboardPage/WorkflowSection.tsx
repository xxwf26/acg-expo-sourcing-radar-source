const ROADMAP = [
  '第 1 阶段：独立前后端 + 本地数据库，脱离飞书妙搭，先服务 AX / gamescom 等已确定场景。',
  '第 2 阶段：建联状态、备注、业务收藏多人协同（已落数据库）。',
  '第 3 阶段：增加定时监控，自动发现新嘉宾、新展商、新 artist alley 名单。',
  '第 4 阶段：AI 做采购推荐，输出“为什么值得聊、怎么聊、可能风险”。',
  '第 5 阶段：展后沉淀供应商画像，回流到内部创作者/供应商知识库。',
];

export default function WorkflowSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="text-sm font-semibold">产品落地路线</h3>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          {ROADMAP.map((r, i) => (
            <li key={r} className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
      <aside className="space-y-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">和画师库的关系</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            画师库是“内部合作作品与创作者复购库”，解决已合作的人怎么查、怎么复盘。这个雷达是“外部机会发现库”，解决还没合作的人怎么发现、判断、建联。
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold">一句话包装</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            面向营销采购和业务方的 ACG 展会机会雷达，自动汇总未来大展参展方、嘉宾、艺术家与供应商信息，并按采购匹配度推荐优先建联对象。
          </p>
        </div>
      </aside>
    </div>
  );
}
