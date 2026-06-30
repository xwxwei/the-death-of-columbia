import {
  GameState,
  StoryEvent,
  applyStateChange,
  cloneGame,
  events,
  pushLog,
  revealClue
} from "./GameState";

export function triggerRoundEvents(game: GameState): GameState {
  const next = cloneGame(game);
  const triggered = events.filter((event) => shouldTriggerEvent(next, event));

  for (const event of triggered) {
    next.triggeredEventIds.push(event.id);

    for (const effect of event.effects) {
      applyStateChange(next, effect);
    }

    const unlockedClues: string[] = [];
    for (const clueId of event.unlocks_clues ?? []) {
      if (revealClue(next, clueId, "known", event.title)) {
        unlockedClues.push(clueId);
      }
    }

    pushLog(next, {
      round: next.round,
      phase: "settlement",
      type: "event",
      title: event.title,
      body: event.description,
      changes: event.effects,
      relatedClues: unlockedClues
    });
  }

  return next;
}

function shouldTriggerEvent(game: GameState, event: StoryEvent): boolean {
  if (event.round !== game.round) {
    return false;
  }

  if (game.triggeredEventIds.includes(event.id)) {
    return false;
  }

  if (event.required) {
    return true;
  }

  return matchesConditions(game, event.trigger_conditions ?? {});
}

function matchesConditions(game: GameState, conditions: Record<string, string | number | boolean>): boolean {
  for (const [key, value] of Object.entries(conditions)) {
    switch (key) {
      case "investigated":
        if (!game.flags.investigatedTargets.includes(String(value))) {
          return false;
        }
        break;
      case "military_force_move":
        if (game.flags.militaryForceMove !== value) {
          return false;
        }
        break;
      case "worker_support_below":
        if (!(game.state.worker_support < Number(value))) {
          return false;
        }
        break;
      case "truth_visibility_above":
        if (!(game.state.truth_visibility > Number(value))) {
          return false;
        }
        break;
      case "public_trust_above":
        if (!(game.state.public_trust > Number(value))) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  return true;
}
