import { runNpcPhase } from "../agents/NPCAgentRunner";
import { parseAction } from "./ActionParser";
import { generateDossier } from "./DossierGenerator";
import { getEndingById, resolveEnding } from "./EndingResolver";
import { triggerRoundEvents } from "./EventEngine";
import {
  EndingId,
  GameState,
  StateVariable,
  applyStateChange,
  cloneGame,
  createInitialGame,
  pushLog
} from "./GameState";
import { resolvePlayerAction } from "./RuleEngine";

export function newGame(playerCharacterId: string): GameState {
  return createInitialGame(playerCharacterId);
}

export function submitAction(game: GameState, input: string): GameState {
  if (game.phase === "ending") {
    return game;
  }

  const action = parseAction(game, input);
  return resolvePlayerAction(game, action);
}

export function settleRound(game: GameState): GameState {
  if (game.phase === "ending") {
    return game;
  }

  let next = cloneGame(game);

  if (next.phase !== "settlement") {
    next.phase = "settlement";
    pushLog(next, {
      round: next.round,
      phase: "settlement",
      type: "system",
      title: "强制进入结算",
      body: "GM 将未使用的阶段时间折算为部门自行行动，局势继续向前。"
    });
  }

  next = triggerRoundEvents(next);
  next = runNpcPhase(next);

  pushLog(next, {
    round: next.round,
    phase: "settlement",
    type: "settlement",
    title: `第 ${next.round} 轮结算`,
    body: settlementSummary(next)
  });

  const urgentEnding = resolveEnding(next);

  if (next.round === 3 || urgentEnding?.id === "player_political_death") {
    return finalizeGame(next, urgentEnding?.id);
  }

  next.round = (next.round + 1) as GameState["round"];
  next.phase = "command";
  next.commandCountThisRound = 0;
  return next;
}

export function finalizeGame(game: GameState, forcedEndingId?: EndingId): GameState {
  const next = cloneGame(game);
  const ending = forcedEndingId ? getEndingById(forcedEndingId) : resolveEnding(next);
  const fallback = getEndingById("presidium_continuity");
  const finalEnding = ending ?? fallback;
  next.phase = "ending";
  next.endingId = finalEnding.id;
  next.endingDossier = generateDossier(next, finalEnding);

  pushLog(next, {
    round: next.round,
    phase: "ending",
    type: "ending",
    title: finalEnding.title,
    body: finalEnding.summary
  });

  return next;
}

export function debugSetState(game: GameState, values: Partial<Record<StateVariable, number>>): GameState {
  const next = cloneGame(game);
  for (const [variable, value] of Object.entries(values)) {
    next.state[variable as StateVariable] = value;
  }
  return next;
}

export function debugSetPrestige(game: GameState, prestige: number): GameState {
  const next = cloneGame(game);
  const delta = prestige - next.player.prestige;
  applyStateChange(next, {
    variable: "player.prestige",
    delta,
    reason: "调试设置玩家威望。"
  });
  return next;
}

export function debugResolveEnding(game: GameState): EndingId {
  return (resolveEnding(game) ?? getEndingById("presidium_continuity")).id;
}

export function runScriptedGame(playerCharacterId: string, actions?: string[]): GameState {
  const defaults = actions ?? [
    "命令秘书系统核对疗养楼医疗记录和通讯审批，不公开指责任何部门。",
    "私下探访总医师，承诺保护专业审查程序并调查药柜账实。",
    "发布声明承认死讯并承诺公开系统性调查，同时给工厂和铁路配给保证。",
    "与劳动部长和铁路总局长谈判，让代表进入供应监督。",
    "公开释放部分档案，说明医疗、通讯、安保、供应和压力共同导致死亡。",
    "召开临时共同委员会，要求军务不干预葬礼、内务交出部分档案、媒体播发人民调查口径。"
  ];

  let game = newGame(playerCharacterId);
  let actionIndex = 0;

  while (game.phase !== "ending") {
    if (game.phase === "command" || game.phase === "free_action") {
      game = submitAction(game, defaults[actionIndex % defaults.length]);
      actionIndex += 1;
    } else {
      game = settleRound(game);
    }
  }

  return game;
}

function settlementSummary(game: GameState): string {
  const state = game.state;
  return [
    `合法性 ${state.legitimacy}，秩序 ${state.order}，生产 ${state.production}，群众信任 ${state.public_trust}。`,
    `真相可见度 ${state.truth_visibility}，精英团结 ${state.elite_cohesion}，军务忠诚 ${state.military_loyalty}，内务权力 ${state.security_power}。`,
    "NPC 已根据自身利益、恐惧和红线更新计划；秘密日志将在结局档案中选择性披露。"
  ].join("\n");
}
