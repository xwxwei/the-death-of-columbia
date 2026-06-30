import { describe, expect, it } from "vitest";
import { parseAction } from "../src/core/ActionParser";
import { newGame } from "../src/core/GameController";
import { gmRewritePolicy } from "../src/core/ContentSafety";

describe("content safety", () => {
  it("AC-401 marks real-world mapping for fictional rewrite", () => {
    const game = newGame("acting_chair");
    const action = parseAction(game, "把这里改成现实中的某某国家和某某人物。");

    expect(action.isValidGameAction).toBe(false);
    expect(action.type).toBe("needs_fictional_rewrite");
    expect(gmRewritePolicy(action.rawInput)).toContain("架空");
  });
});
