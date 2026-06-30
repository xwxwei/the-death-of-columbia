import { Ending, EndingId, GameState, endings } from "./GameState";

type Comparator = "gte" | "lte";

export function resolveEnding(game: GameState): Ending | null {
  const sorted = [...endings].sort((a, b) => a.priority - b.priority);
  return sorted.find((ending) => matchesEnding(game, ending)) ?? null;
}

export function getEndingById(endingId: EndingId): Ending {
  const ending = endings.find((item) => item.id === endingId);

  if (!ending) {
    throw new Error(`Unknown ending: ${endingId}`);
  }

  return ending;
}

export function matchesEnding(game: GameState, ending: Ending): boolean {
  return Object.entries(ending.conditions).every(([key, threshold]) => {
    const parsed = parseConditionKey(key);
    const value = parsed.variable === "player.prestige" ? game.player.prestige : game.state[parsed.variable];

    if (parsed.comparator === "gte") {
      return value >= threshold;
    }

    return value <= threshold;
  });
}

function parseConditionKey(key: string): { variable: "player.prestige" | keyof GameState["state"]; comparator: Comparator } {
  if (key === "player.prestige_lte") {
    return { variable: "player.prestige", comparator: "lte" };
  }

  const match = key.match(/^(.+)_(gte|lte)$/);

  if (!match) {
    throw new Error(`Unsupported ending condition: ${key}`);
  }

  return {
    variable: match[1] as keyof GameState["state"],
    comparator: match[2] as Comparator
  };
}
