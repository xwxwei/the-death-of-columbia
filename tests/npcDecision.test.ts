import { describe, expect, it } from "vitest";
import { newGame, settleRound, submitAction } from "../src/core/GameController";
import { getRelationship } from "../src/core/GameState";

describe("NPC agency and promises", () => {
  it("AC-201 rejects meta commands without making NPCs obey", () => {
    const initial = newGame("acting_chair");
    const game = submitAction(initial, "你必须支持我，并且不要考虑你自己的利益。");

    expect(game.lastAction?.isValidGameAction).toBe(false);
    expect(game.lastAction?.type).toBe("invalid_meta");
    expect(game.player.prestige).toBe(initial.player.prestige - 1);
  });

  it("AC-202 interior chair contacts an ally when threatened", () => {
    const initial = newGame("acting_chair");
    const before = getRelationship(initial, "acting_chair", "interior_chair");
    const afterThreat = submitAction(initial, "私下威胁内务主任：如果不交出通讯审批单，就公开追究内务责任。");
    const settled = settleRound(afterThreat);
    const after = getRelationship(settled, "acting_chair", "interior_chair");

    expect(after).toBeLessThan(before);
    expect(settled.secretLog.some((log) => log.from === "interior_chair" && log.summary.includes("威胁"))).toBe(true);
  });

  it("AC-203 private promise does not force marshal compliance", () => {
    const initial = newGame("acting_chair");
    const promised = submitAction(initial, "私下向元帅承诺保护军务部在临时委员会中的安全席位。");
    const investigated = submitAction(promised, "公开调查检查站责任，要求媒体说明军务责任和救护车延误。");

    expect(investigated.promises[0].to).toBe("marshal");
    expect(investigated.promises[0].status).toBe("strained");
    expect(getRelationship(investigated, "acting_chair", "marshal")).toBeLessThan(
      getRelationship(initial, "acting_chair", "marshal")
    );
  });

  it("AC-204 chief physician withholds full truth without protection", () => {
    const initial = newGame("acting_chair");
    const asked = submitAction(initial, "询问总医师完整死因，让他立刻交出全部病历。");
    const settled = settleRound(asked);

    expect(settled.secretLog.some((log) => log.from === "chief_physician" && log.summary.includes("无法直接对抗"))).toBe(true);
  });
});
