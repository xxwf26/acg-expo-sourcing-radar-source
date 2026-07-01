import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import ChipEditor from '@/components/ChipEditor';
import { useSourcingConfig, useCrawlMutations } from '@/hooks/useCrawl';

/**
 * 采购匹配配置编辑（P3-A）。会议纪要「告诉 AI 采购模块、对标公司」。
 * 保存后可在候选复核里点「AI 打分」按这套配置给候选打匹配分。
 */
export default function SourcingConfigModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { data } = useSourcingConfig();
  const { saveConfig } = useCrawlMutations();

  const [modules, setModules] = useState<string[]>([]);
  const [benchmarks, setBenchmarks] = useState<string[]>([]);
  const [rubric, setRubric] = useState('');

  useEffect(() => {
    if (open && data) {
      setModules(data.modules || []);
      setBenchmarks(data.benchmarks || []);
      setRubric(data.scoringRubric || '');
    }
  }, [open, data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">采购匹配配置</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            这套配置是 AI 给候选打「匹配分」的依据——相当于告诉 AI「我们采购什么、对标谁」。
            保存后在候选复核点「AI 打分」即按此评分排序。
          </p>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">采购模块（我们要找的类型）</p>
            <ChipEditor value={modules} onChange={setModules} placeholder="如 画师、KOL、美术供应商，回车添加" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">对标公司 / IP（风格·量级参照）</p>
            <ChipEditor value={benchmarks} onChange={setBenchmarks} placeholder="如 漫威、迪士尼，回车添加" />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-muted-foreground">打分口径（可选）</p>
            <Textarea
              value={rubric}
              onChange={(e) => setRubric(e.target.value)}
              rows={3}
              placeholder="补充说明什么样的对象更值得高分，如：偏好女性向角色画师、有周边授权能力者加分"
            />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>取消</Button>
            <Button
              size="sm"
              disabled={saveConfig.isPending}
              onClick={() =>
                saveConfig.mutate(
                  { modules, benchmarks, scoringRubric: rubric },
                  { onSuccess: () => onOpenChange(false) },
                )
              }
            >
              {saveConfig.isPending ? '保存中…' : '保存'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
