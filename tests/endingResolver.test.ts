import { describe, expect, it } from "vitest";
import { debugResolveEnding, debugSetPrestige, debugSetState, newGame } from "../src/core/GameController";

describe("EndingResolver acceptance matrix", () => {
  it("AC-301 resolves presidium continuity", () => {
    const game = debugSetState(newGame("acting_chair"), {
      legitimacy: 75,
      elite_cohesion: 70,
      order: 55,
      truth_visibility: 35
    });

    expect(debugResolveEnding(game)).toBe("presidium_continuity");
  });

  it("AC-302 resolves marshal protectorate", () => {
    const game = debugSetState(newGame("marshal"), {
      military_loyalty: 80,
      order: 75,
      legitimacy: 45,
      foreign_pressure: 65
    });

    expect(debugResolveEnding(game)).toBe("marshal_protectorate");
  });

  it("AC-303 resolves interior purge", () => {
    const game = debugSetState(newGame("interior_chair"), {
      security_power: 85,
      truth_visibility: 25,
      order: 60,
      public_trust: 35
    });

    expect(debugResolveEnding(game)).toBe("interior_purge");
  });

  it("AC-304 resolves labor ascendant", () => {
    const game = debugSetState(newGame("labor_minister"), {
      worker_support: 80,
      production: 60,
      public_trust: 65,
      military_loyalty: 45
    });

    expect(debugResolveEnding(game)).toBe("labor_ascendant");
  });

  it("AC-305 resolves technocratic reform", () => {
    const game = debugSetState(newGame("planning_director"), {
      reform_momentum: 80,
      foreign_pressure: 70,
      production: 45,
      elite_cohesion: 55
    });

    expect(debugResolveEnding(game)).toBe("technocratic_reform");
  });

  it("AC-306 resolves provisional accord", () => {
    const game = debugSetState(newGame("external_commissar"), {
      truth_visibility: 80,
      public_trust: 75,
      elite_cohesion: 60,
      order: 55,
      worker_support: 60,
      military_loyalty: 50,
      security_power: 45
    });

    expect(debugResolveEnding(game)).toBe("provisional_accord");
  });

  it("AC-307 resolves dual power collapse", () => {
    const game = debugSetState(newGame("acting_chair"), {
      order: 20,
      elite_cohesion: 20,
      production: 25,
      public_trust: 30
    });

    expect(debugResolveEnding(game)).toBe("dual_power_collapse");
  });

  it("AC-308 player political death outranks every other ending", () => {
    const stableState = debugSetState(newGame("acting_chair"), {
      truth_visibility: 80,
      public_trust: 75,
      elite_cohesion: 60,
      order: 55,
      worker_support: 60,
      military_loyalty: 50,
      security_power: 45
    });
    const game = debugSetPrestige(stableState, 0);

    expect(debugResolveEnding(game)).toBe("player_political_death");
  });
});
