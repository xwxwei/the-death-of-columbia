import { ActionResolution } from "../core/GameState";

export function gmAdjudicationSummary(resolution: ActionResolution): string {
  const clueText =
    resolution.unlockedClues.length > 0
      ? `线索更新：${resolution.unlockedClues.join("、")}。`
      : "没有立即解锁新线索。";

  return `${resolution.summary} ${clueText} 本次裁定来自结构化状态，GM 不会因玩家要求修改规则。`;
}
