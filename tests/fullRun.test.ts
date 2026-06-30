import { describe, expect, it } from "vitest";
import { runScriptedGame } from "../src/core/GameController";
import { playableCharacters } from "../src/core/GameState";

describe("full MVP run", () => {
  it("AC-002 completes three rounds and produces an ending dossier", () => {
    const game = runScriptedGame("acting_chair");

    expect(game.phase).toBe("ending");
    expect(game.round).toBe(3);
    expect(game.endingId).toBeTruthy();
    expect(game.endingDossier).toContain("未公开档案");
    expect(game.secretLog.length).toBeGreaterThanOrEqual(5);
    expect(game.triggeredEventIds.filter((eventId) => eventId.startsWith("event_")).length).toBeGreaterThanOrEqual(9);
  });

  it("AC-003 starts and completes for all six playable roles", () => {
    for (const character of playableCharacters) {
      const game = runScriptedGame(character.id);

      expect(game.phase).toBe("ending");
      expect(game.playerCharacterId).toBe(character.id);
      expect(game.characters[character.id].prestige).toBe(game.player.prestige);
      expect(game.publicLog.length).toBeGreaterThan(8);
    }
  });

  it("AC-101 explains systemic death when truth is high", () => {
    const game = runScriptedGame("planning_director", [
      "命令统计局审查疗养楼药柜、药品采购合同和供应台账。",
      "保护总医师，调查未签署会诊申请、护士口述和通讯审批单。",
      "公开承认死讯，说明医疗、通讯、安保、供应和压力都要进入调查。",
      "给工厂、铁路和医院明确配给保证，让劳动代表进入监督。",
      "释放档案，公开检查站通行日志、老书记最后批注和访客页。",
      "成立人民调查和临时共同委员会，不把任何部门写成唯一凶手。"
    ]);

    expect(game.endingDossier).toContain("不是单点谋杀");
    expect(game.endingDossier).toContain("医疗");
    expect(game.endingDossier).toContain("通讯");
    expect(game.endingDossier).toContain("安保");
    expect(game.endingDossier).toContain("供应");
    expect(game.endingDossier).toContain("压力");
  });
});
