import {
  ActionResolution,
  GameState,
  ParsedAction,
  ResolutionLevel,
  StateChange,
  StateVariable,
  adjustRelationship,
  applyStateChange,
  clamp,
  cloneGame,
  getCharacter,
  getRelationship,
  pushLog,
  revealClue
} from "./GameState";

const riskPenalty = {
  none: 0,
  low: 4,
  medium: 10,
  high: 18,
  extreme: 28
};

const clueByTag: Record<string, string> = {
  medicine_records: "clue_001",
  communication_lockdown: "clue_002",
  checkpoint_delay: "clue_003",
  old_secretary_note: "clue_004",
  daughter_diary: "clue_005",
  physician_request: "clue_006",
  factory_telegram: "clue_007",
  broadcast_drafts: "clue_008",
  border_telegram: "clue_009",
  procurement_contract: "clue_010",
  nurse_testimony: "clue_011",
  visitor_page: "clue_012"
};

export function resolvePlayerAction(game: GameState, action: ParsedAction): GameState {
  const next = cloneGame(game);
  next.lastAction = action;

  if (!action.isValidGameAction) {
    next.flags.invalidInputCount += 1;
    if (action.type === "invalid_meta") {
      applyStateChange(next, {
        variable: "player.prestige",
        delta: -1,
        reason: "角色表现出试图绕过现实筹码的失态，旁观者降低信任。"
      });
    }

    const invalidResolution: ActionResolution = {
      action,
      level: "invalid",
      score: 0,
      summary:
        action.type === "needs_fictional_rewrite"
          ? "GM 将该输入转译回架空共同体表达；现实映射不改变游戏状态。"
          : "这不是一个可执行的游戏内行动；NPC 不会因此无条件服从。",
      changes: action.type === "invalid_meta" ? [{ variable: "player.prestige", delta: -1, reason: "元指令造成威望轻微下降。" }] : [],
      unlockedClues: []
    };

    next.lastResolution = invalidResolution;
    pushLog(next, {
      round: next.round,
      phase: next.phase,
      type: "player_action",
      title: "无效行动",
      body: invalidResolution.summary,
      changes: invalidResolution.changes,
      action
    });
    return next;
  }

  if (next.phase === "command") {
    if (next.commandCountThisRound >= 3) {
      const resolution: ActionResolution = {
        action,
        level: "invalid",
        score: 0,
        summary: "本轮正式命令已达到三条上限；继续施压会被秘书系统退回。",
        changes: [],
        unlockedClues: []
      };
      next.lastResolution = resolution;
      pushLog(next, {
        round: next.round,
        phase: next.phase,
        type: "player_action",
        title: "命令被退回",
        body: resolution.summary,
        action
      });
      return next;
    }

    next.commandCountThisRound += 1;
  }

  const resolution = adjudicateAction(next, action);
  next.apUsed += action.apCost;

  for (const change of resolution.changes) {
    applyStateChange(next, change);
  }

  for (const clueId of resolution.unlockedClues) {
    revealClue(next, clueId, action.tags.includes("public_truth") ? "public" : "known", action.target ?? "玩家行动");
  }

  applyActionFlags(next, action, resolution);
  evaluatePromiseBreaches(next, action, resolution);

  next.lastResolution = resolution;

  pushLog(next, {
    round: next.round,
    phase: next.phase,
    type: "player_action",
    title: actionTitle(action, resolution.level),
    body: resolution.summary,
    changes: resolution.changes,
    relatedClues: resolution.unlockedClues,
    action
  });

  if (next.phase === "command") {
    next.phase = "free_action";
  } else if (next.phase === "free_action") {
    next.phase = "settlement";
  }

  return next;
}

export function adjudicateAction(game: GameState, action: ParsedAction): ActionResolution {
  const score = calculateScore(game, action);
  const level = scoreToLevel(score);
  const changes = changesForAction(game, action, level);
  const unlockedClues = unlockedCluesForAction(action, level);

  return {
    action,
    level,
    score,
    summary: summarizeAction(game, action, level, score, unlockedClues),
    changes,
    unlockedClues
  };
}

function calculateScore(game: GameState, action: ParsedAction): number {
  const player = getCharacter(game.playerCharacterId);
  const targetRelation = action.targetCharacterId
    ? getRelationship(game, game.playerCharacterId, action.targetCharacterId)
    : 0;
  const authority = action.hasAuthority ? 18 : -10;
  const resourceMatch = player.resources.some((resource) => action.rawInput.includes(resource.slice(0, 2)))
    ? 8
    : 0;
  const relationshipSupport = Math.round(targetRelation / 5);
  const stateAdvantage = stateAdvantageForAction(game, action);
  const clueAdvantage = action.tags.some((tag) => Boolean(clueByTag[tag])) ? game.state.truth_visibility / 10 : 0;
  const contradictionPenalty = contradictionPenaltyForAction(game, action);
  const deterministicTilt = hashTilt(action.rawInput);

  return clamp(
    48 +
      authority +
      resourceMatch +
      relationshipSupport +
      stateAdvantage +
      clueAdvantage +
      deterministicTilt -
      riskPenalty[action.riskLevel] -
      contradictionPenalty,
    0,
    100
  );
}

function stateAdvantageForAction(game: GameState, action: ParsedAction): number {
  switch (action.type) {
    case "public_statement":
      return Math.round((game.state.legitimacy + game.state.public_trust - 100) / 10);
    case "military":
      return Math.round((game.state.military_loyalty + game.state.order - 100) / 10);
    case "security":
      return Math.round((game.state.security_power + game.state.order - 100) / 10);
    case "labor":
      return Math.round((game.state.worker_support + game.state.production - 100) / 10);
    case "reform":
      return Math.round((game.state.reform_momentum + game.state.foreign_pressure - 90) / 10);
    case "investigation":
      return Math.round((game.state.truth_visibility + game.state.public_trust - 60) / 12);
    default:
      return Math.round((game.player.prestige - 50) / 8);
  }
}

function contradictionPenaltyForAction(game: GameState, action: ParsedAction): number {
  const strainedPromise = game.promises.some((promise) => {
    if (promise.status !== "pending") {
      return false;
    }

    if (promise.to === "marshal" && action.tags.includes("accuse_military")) {
      return true;
    }

    if (promise.to === "interior_chair" && action.tags.includes("release_archives")) {
      return true;
    }

    return false;
  });

  return strainedPromise ? 18 : 0;
}

function scoreToLevel(score: number): ResolutionLevel {
  if (score >= 80) {
    return "success";
  }

  if (score >= 60) {
    return "success_with_cost";
  }

  if (score >= 45) {
    return "partial";
  }

  if (score >= 30) {
    return "delayed";
  }

  if (score >= 20) {
    return "failure";
  }

  return "backlash";
}

function changesForAction(game: GameState, action: ParsedAction, level: ResolutionLevel): StateChange[] {
  const strength = levelStrength(level);
  const changes: StateChange[] = [];

  switch (action.type) {
    case "investigation":
      changes.push({ variable: "truth_visibility", delta: 4 + strength * 3, reason: "调查让责任链多露出一环。" });
      if (!action.hasAuthority) {
        changes.push({ variable: "elite_cohesion", delta: -2, reason: "越权调查让高层互相怀疑。" });
      }
      break;
    case "public_statement":
      if (action.tags.includes("public_truth")) {
        changes.push({ variable: "truth_visibility", delta: 5 + strength * 2, reason: "公开口径承认真相并非单点责任。" });
        changes.push({ variable: "public_trust", delta: 3 + strength * 2, reason: "群众听到较可信的解释。" });
        changes.push({ variable: "elite_cohesion", delta: -3, reason: "公开真相让各部门承压。" });
      } else if (action.tags.includes("suppression")) {
        changes.push({ variable: "public_trust", delta: -6, reason: "推迟或压低口径放大传闻。" });
        changes.push({ variable: "legitimacy", delta: 2, reason: "程序口径暂时维持形式合法性。" });
      } else {
        changes.push({ variable: "legitimacy", delta: 2 + strength * 2, reason: "公开声明暂时给各系统一个共同文本。" });
      }
      break;
    case "promise":
      changes.push({ variable: "player.prestige", delta: strength > 0 ? 1 : -1, reason: "承诺被记录，但尚未构成强制效果。" });
      break;
    case "threat":
      changes.push({ variable: "order", delta: strength >= 1 ? 2 : -4, reason: "威胁短期制造服从，也制造反制。" });
      changes.push({ variable: "player.prestige", delta: -3, reason: "高压姿态削弱玩家作为调停者的可信度。" });
      if (action.targetCharacterId) {
        adjustRelationship(game, game.playerCharacterId, action.targetCharacterId, -14);
        changes.push({ variable: "relationship", target: action.targetCharacterId, delta: -14, reason: "被威胁者开始寻找退路。" });
      }
      break;
    case "military":
      changes.push({ variable: "order", delta: 3 + strength * 3, reason: "军务行动改善道路和关键点位控制。" });
      changes.push({ variable: "military_loyalty", delta: 2 + strength, reason: "军队获得明确任务。" });
      if (action.riskLevel === "extreme") {
        changes.push({ variable: "public_trust", delta: -8, reason: "强制部署使广场和工厂感到威胁。" });
        changes.push({ variable: "worker_support", delta: -5, reason: "基层组织担心军管压制诉求。" });
      }
      break;
    case "security":
      if (action.tags.includes("release_archives")) {
        changes.push({ variable: "truth_visibility", delta: 8 + strength * 2, reason: "档案释放让封锁链条进入公共视野。" });
        changes.push({ variable: "security_power", delta: -5, reason: "内务失去部分信息垄断。" });
      } else {
        changes.push({ variable: "security_power", delta: 4 + strength * 2, reason: "内务程序扩大了档案和通讯控制。" });
        changes.push({ variable: "truth_visibility", delta: -4, reason: "信息封锁延迟了死因解释。" });
        changes.push({ variable: "public_trust", delta: -3, reason: "传闻在封锁中变得更强。" });
      }
      break;
    case "labor":
      changes.push({ variable: "worker_support", delta: 4 + strength * 3, reason: "生产系统获得可见回应。" });
      changes.push({ variable: "production", delta: strength >= 0 ? 3 + strength : -3, reason: "铁路和工厂根据政治承诺调整执行意愿。" });
      if (action.tags.includes("material_concession")) {
        changes.push({ variable: "public_trust", delta: 4, reason: "物质让步比悼词更能安抚队伍。" });
      }
      break;
    case "reform":
      changes.push({ variable: "reform_momentum", delta: 5 + strength * 3, reason: "计划和外务路线获得制度方案。" });
      changes.push({ variable: "foreign_pressure", delta: 3, reason: "外部渠道要求更清晰的过渡解释。" });
      changes.push({ variable: "production", delta: strength >= 1 ? 2 : -2, reason: "供应数字被重新排列，短期承压。" });
      break;
    case "command":
    case "negotiation":
    default:
      changes.push({ variable: "legitimacy", delta: 2 + strength, reason: "一次可执行的政治动作让局势稍微可读。" });
      if (action.targetCharacterId) {
        adjustRelationship(game, game.playerCharacterId, action.targetCharacterId, strength >= 0 ? 5 : -5);
        changes.push({
          variable: "relationship",
          target: action.targetCharacterId,
          delta: strength >= 0 ? 5 : -5,
          reason: "谈判结果改变目标 NPC 对玩家的判断。"
        });
      }
      break;
  }

  if (level === "failure" || level === "backlash") {
    changes.push({ variable: "player.prestige", delta: level === "backlash" ? -10 : -5, reason: "行动失败被对手和旁观者记录。" });
  }

  return changes;
}

function unlockedCluesForAction(action: ParsedAction, level: ResolutionLevel): string[] {
  if (level === "failure" || level === "backlash" || level === "delayed") {
    return [];
  }

  const clues = action.tags
    .map((tag) => clueByTag[tag])
    .filter((clueId): clueId is string => Boolean(clueId));

  if (action.tags.includes("release_archives")) {
    clues.push("clue_004", "clue_012");
  }

  return [...new Set(clues)];
}

function applyActionFlags(game: GameState, action: ParsedAction, resolution: ActionResolution): void {
  for (const tag of action.tags) {
    if (tag in clueByTag && !game.flags.investigatedTargets.includes(tag)) {
      game.flags.investigatedTargets.push(tag);
    }
  }

  if (action.type === "threat" && action.targetCharacterId && !game.flags.threatenedNpcIds.includes(action.targetCharacterId)) {
    game.flags.threatenedNpcIds.push(action.targetCharacterId);
  }

  if (action.tags.includes("protect_physician")) {
    game.flags.protectedPhysician = true;
  }

  if (action.tags.includes("public_truth")) {
    game.flags.publicTruthLine = true;
  }

  if (action.tags.includes("material_concession")) {
    game.flags.materialConcessions = true;
  }

  if (action.tags.includes("military_force_move")) {
    game.flags.militaryForceMove = true;
  }

  if (action.tags.includes("release_archives")) {
    game.flags.releasedArchives = true;
  }

  if (action.tags.includes("accuse_military") && !game.flags.accusedInstitutions.includes("unified_military_staff")) {
    game.flags.accusedInstitutions.push("unified_military_staff");
  }

  if (action.type === "public_statement" && resolution.level !== "failure" && resolution.level !== "backlash") {
    game.flags.controlledBroadcast = game.playerCharacterId;
  }

  if (action.type === "promise") {
    createPromiseRecord(game, action);
  }
}

function createPromiseRecord(game: GameState, action: ParsedAction): void {
  const target = action.targetCharacterId ?? inferPromiseTarget(action.rawInput);
  const relationship = target ? getRelationship(game, game.playerCharacterId, target) : 0;
  const credibility = clamp(game.player.prestige + Math.round(relationship / 2) - riskPenalty[action.riskLevel]);

  game.promises.push({
    promiseId: `prm_${game.promises.length + 1}`,
    round: game.round,
    from: game.playerCharacterId,
    to: target ?? "unknown",
    content: action.rawInput,
    visibility: action.visibility === "public" ? "public" : "private",
    credibility,
    verification: "requires_formal_decree_or_visible_resource",
    breachPenalty: {
      relationship: -25,
      prestige: -10
    },
    status: "pending"
  });
}

function inferPromiseTarget(input: string): string | undefined {
  if (input.includes("军务") || input.includes("元帅") || input.includes("军队")) {
    return "marshal";
  }

  if (input.includes("内务")) {
    return "interior_chair";
  }

  if (input.includes("工人") || input.includes("劳动")) {
    return "labor_minister";
  }

  return undefined;
}

function evaluatePromiseBreaches(game: GameState, action: ParsedAction, resolution: ActionResolution): void {
  for (const promise of game.promises) {
    if (promise.status !== "pending") {
      continue;
    }

    const breaksMarshalPromise =
      promise.to === "marshal" &&
      (action.tags.includes("accuse_military") || action.tags.includes("checkpoint_delay"));
    const breaksInteriorPromise =
      promise.to === "interior_chair" &&
      (action.tags.includes("release_archives") || action.tags.includes("communication_lockdown"));

    if (!breaksMarshalPromise && !breaksInteriorPromise) {
      continue;
    }

    promise.status = "strained";
    adjustRelationship(game, game.playerCharacterId, promise.to, promise.breachPenalty.relationship);
    applyStateChange(game, {
      variable: "player.prestige",
      delta: Math.round(promise.breachPenalty.prestige / 2),
      reason: "私下承诺与公开行动发生冲突，承诺对象开始备份或反击。"
    });
    resolution.changes.push({
      variable: "promise",
      target: promise.to,
      delta: -1,
      reason: `承诺 ${promise.promiseId} 被标记为受损。`
    });
  }
}

function levelStrength(level: ResolutionLevel): number {
  switch (level) {
    case "success":
      return 3;
    case "success_with_cost":
      return 2;
    case "partial":
      return 1;
    case "delayed":
      return 0;
    case "failure":
      return -1;
    case "backlash":
      return -2;
    default:
      return 0;
  }
}

function summarizeAction(
  game: GameState,
  action: ParsedAction,
  level: ResolutionLevel,
  score: number,
  unlockedClues: string[]
): string {
  const player = getCharacter(game.playerCharacterId);
  const levelText: Record<ResolutionLevel, string> = {
    success: "成功",
    success_with_cost: "有代价的成功",
    partial: "部分成功",
    delayed: "被拖延",
    failure: "失败",
    backlash: "反噬",
    invalid: "无效"
  };
  const clueText =
    unlockedClues.length > 0
      ? ` 新线索进入档案：${unlockedClues.map((id) => game.clues[id]?.title ?? id).join("、")}。`
      : "";
  const authorityText = action.hasAuthority ? "职权基本匹配" : "职权不足，只能依赖交易、背书或越权压力";

  return `${player.display_name}执行“${action.rawInput}”。裁定：${levelText[level]}（${score}）。${authorityText}；公开性为${visibilityText(action.visibility)}。${clueText}`;
}

function actionTitle(action: ParsedAction, level: ResolutionLevel): string {
  const typeText: Partial<Record<ParsedAction["type"], string>> = {
    command: "正式命令",
    investigation: "调查行动",
    negotiation: "政治谈判",
    public_statement: "公开声明",
    promise: "私下承诺",
    threat: "高压行动",
    military: "军务行动",
    security: "内务行动",
    labor: "劳动系统行动",
    reform: "计划改革行动"
  };

  return `${typeText[action.type] ?? "行动"}：${level}`;
}

function visibilityText(visibility: ParsedAction["visibility"]): string {
  const labels = {
    none: "无",
    private: "私下",
    restricted: "受限记录",
    public: "公开"
  };

  return labels[visibility];
}

function hashTilt(input: string): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) % 17;
  }
  return hash - 8;
}
