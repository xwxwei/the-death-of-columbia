import {
  Character,
  GameState,
  StateChange,
  adjustRelationship,
  applyStateChange,
  characters,
  cloneGame,
  getCharacter,
  getRelationship,
  pushLog,
  pushSecretLog,
  revealClue
} from "../core/GameState";

type NpcDecision = {
  npcId: string;
  stanceTowardPlayer: "supportive" | "cautious" | "hostile" | "self_protective";
  trustPlayerDelta: number;
  publicResponse: string;
  privateContact: {
    to: string;
    summary: string;
    motive: string;
    outcome: string;
  };
  changes: StateChange[];
  revealedClues: string[];
  currentPlan: string;
};

export function runNpcPhase(game: GameState): GameState {
  const next = cloneGame(game);
  const decisions = characters
    .filter((character) => character.id !== next.playerCharacterId)
    .map((character) => decideNpcAction(next, character));

  const summaries: string[] = [];

  for (const decision of decisions) {
    const runtime = next.characters[decision.npcId];
    runtime.stanceToPlayer = decision.stanceTowardPlayer;
    runtime.currentPlan = decision.currentPlan;
    adjustRelationship(next, decision.npcId, next.playerCharacterId, decision.trustPlayerDelta);

    for (const change of decision.changes) {
      applyStateChange(next, change);
    }

    for (const clueId of decision.revealedClues) {
      revealClue(next, clueId, "known", getCharacter(decision.npcId).display_name);
    }

    pushSecretLog(next, {
      round: next.round,
      from: decision.npcId,
      to: decision.privateContact.to,
      summary: decision.privateContact.summary,
      motive: decision.privateContact.motive,
      outcome: decision.privateContact.outcome,
      visibleToPlayer: false
    });

    summaries.push(`${getCharacter(decision.npcId).display_name}：${decision.publicResponse}`);
  }

  pushLog(next, {
    round: next.round,
    phase: "settlement",
    type: "npc",
    title: "NPC 自主行动",
    body: summaries.join("\n"),
    changes: decisions.flatMap((decision) => decision.changes),
    relatedClues: decisions.flatMap((decision) => decision.revealedClues)
  });

  return next;
}

function decideNpcAction(game: GameState, npc: Character): NpcDecision {
  const threatened = game.flags.threatenedNpcIds.includes(npc.id);
  const relationshipToPlayer = getRelationship(game, npc.id, game.playerCharacterId);
  const lastAction = game.lastAction;
  const targetWasNpc = lastAction?.targetCharacterId === npc.id;
  const playerAttackedRedLine = targetWasNpc && lastAction?.type === "threat";
  const pressure = game.state.order < 40 || game.state.public_trust < 40 || game.state.elite_cohesion < 40;
  const baseTrustDelta = playerAttackedRedLine || threatened ? -10 : relationshipToPlayer > 20 ? 3 : -1;

  switch (npc.id) {
    case "interior_chair":
      return interiorDecision(game, baseTrustDelta, threatened || playerAttackedRedLine);
    case "marshal":
      return marshalDecision(game, baseTrustDelta);
    case "labor_minister":
      return laborDecision(game, baseTrustDelta);
    case "planning_director":
      return planningDecision(game, baseTrustDelta);
    case "external_commissar":
      return externalDecision(game, baseTrustDelta);
    case "old_secretary_daughter":
      return daughterDecision(game, baseTrustDelta);
    case "chief_physician":
      return physicianDecision(game, baseTrustDelta);
    case "rail_director":
      return railDecision(game, baseTrustDelta);
    case "media_editor":
      return mediaDecision(game, baseTrustDelta);
    case "acting_chair":
      return actingChairDecision(game, baseTrustDelta);
    default:
      return genericDecision(game, npc, baseTrustDelta, pressure);
  }
}

function interiorDecision(game: GameState, trustDelta: number, threatened: boolean): NpcDecision {
  const contact = threatened || game.state.truth_visibility > 35 ? "acting_chair" : "media_editor";
  const changes: StateChange[] = [
    { variable: "security_power", delta: threatened ? 4 : 2, reason: "内务委员会加固档案和通讯程序。" }
  ];

  if (game.state.truth_visibility > 55) {
    changes.push({ variable: "public_trust", delta: -2, reason: "内务试图重新包装公开线索，公众反而更怀疑。" });
  }

  return {
    npcId: "interior_chair",
    stanceTowardPlayer: threatened ? "hostile" : "self_protective",
    trustPlayerDelta: threatened ? -14 : trustDelta,
    publicResponse: threatened
      ? "内务主任拒绝接受威胁，并要求把档案安全列入主席团议程。"
      : "内务主任表示可以配合调查，但反对未审计的档案公开。",
    privateContact: {
      to: contact,
      summary: threatened
        ? "要求潜在盟友确认内务封锁属于国家安全程序，并准备反制玩家威胁。"
        : "要求先定义疗养楼通讯记录的密级，再决定能向谁开放。",
      motive: "规避封锁和检查责任，同时保留内务作为危机秩序工具的必要性。",
      outcome: "对方没有完全背书，但同意暂缓把内务定为唯一责任方。"
    },
    changes,
    revealedClues: [],
    currentPlan: "守住档案楼，阻止死因叙事失控。"
  };
}

function marshalDecision(game: GameState, trustDelta: number): NpcDecision {
  const promiseStrained = game.promises.some((promise) => promise.to === "marshal" && promise.status !== "pending");
  const accused = game.flags.accusedInstitutions.includes("unified_military_staff");
  const changes: StateChange[] = [
    { variable: "military_loyalty", delta: accused ? -4 : 2, reason: "军务部根据外界指控重新评估过渡安排。" },
    { variable: "order", delta: game.state.order < 55 ? 3 : 1, reason: "卫戍系统加强关键道路值守。" }
  ];

  return {
    npcId: "marshal",
    stanceTowardPlayer: accused || promiseStrained ? "hostile" : "cautious",
    trustPlayerDelta: accused || promiseStrained ? -12 : trustDelta,
    publicResponse: accused
      ? "元帅要求区分安保程序和致死责任，拒绝让军队成为单一替罪羊。"
      : "元帅声称军队只保护葬礼、道路和边境指挥链。",
    privateContact: {
      to: "old_secretary_daughter",
      summary: "承诺保护家属和葬礼秩序，同时请她不要把检查站问题解释为军队谋害。",
      motive: "保护军队荣誉，并把军事介入包装为秩序保障。",
      outcome: "家属没有公开背书，但愿意继续沟通葬礼安全。"
    },
    changes,
    revealedClues: game.state.truth_visibility > 45 ? ["clue_009"] : [],
    currentPlan: "控制道路但避免过早宣布军管。"
  };
}

function laborDecision(game: GameState, trustDelta: number): NpcDecision {
  const ignoredMaterial = !game.flags.materialConcessions && game.round >= 2;
  const changes: StateChange[] = [
    { variable: "worker_support", delta: ignoredMaterial ? 3 : 5, reason: "劳动系统把悼念与配给、工资和铁路安全连在一起。" },
    { variable: "production", delta: ignoredMaterial ? -2 : 3, reason: "基层是否复工取决于物质承诺是否可信。" }
  ];

  return {
    npcId: "labor_minister",
    stanceTowardPlayer: game.flags.materialConcessions ? "supportive" : "cautious",
    trustPlayerDelta: game.flags.materialConcessions ? 5 : trustDelta,
    publicResponse: "劳动部长要求工厂、铁路和医院代表进入调查与供应监督。",
    privateContact: {
      to: "rail_director",
      summary: "协调铁路班组在葬礼和供应谈判中保持共同立场。",
      motive: "把生产系统从背景推到临时权力安排的桌边。",
      outcome: "铁路同意等待多部门签章，但要求配给保证。"
    },
    changes,
    revealedClues: game.round >= 2 ? ["clue_007"] : [],
    currentPlan: "用复工纪律换取调查席位和物质让步。"
  };
}

function planningDecision(game: GameState, trustDelta: number): NpcDecision {
  return {
    npcId: "planning_director",
    stanceTowardPlayer: "cautious",
    trustPlayerDelta: trustDelta + (game.flags.publicTruthLine ? 2 : 0),
    publicResponse: "计划主任提交供应数字，承认旧台账无法解释药品实际缺口。",
    privateContact: {
      to: "external_commissar",
      summary: "要求外务准备紧急药品和信用说明，避免改革被说成投机。",
      motive: "把死亡解释为旧系统过载，并保护计划系统不独自背锅。",
      outcome: "外务同意同步债务和药品采购口径。"
    },
    changes: [
      { variable: "reform_momentum", delta: 4, reason: "供应数字进入中枢讨论。" },
      { variable: "truth_visibility", delta: game.round >= 2 ? 3 : 1, reason: "药品和统计缺口开始连接死亡链条。" }
    ],
    revealedClues: game.round >= 2 ? ["clue_010"] : [],
    currentPlan: "以数字证明旧制度已经无法靠签字维持。"
  };
}

function externalDecision(game: GameState, trustDelta: number): NpcDecision {
  return {
    npcId: "external_commissar",
    stanceTowardPlayer: game.state.foreign_pressure > 65 ? "self_protective" : "cautious",
    trustPlayerDelta: trustDelta,
    publicResponse: "外务委员提醒各派，极端路线会切断药品、粮食和信用渠道。",
    privateContact: {
      to: "planning_director",
      summary: "同步外部信用声明，要求过渡安排能被贸易和药品渠道理解。",
      motive: "防止军务或内务接管外务谈判。",
      outcome: "计划系统愿意提供真实但分级公开的供应数字。"
    },
    changes: [
      { variable: "foreign_pressure", delta: 4, reason: "外部渠道开始要求明确继承安排。" },
      { variable: "reform_momentum", delta: 2, reason: "债务与药品合同使改革路线更有抓手。" }
    ],
    revealedClues: [],
    currentPlan: "保住谈判权，并与计划系统绑定。"
  };
}

function daughterDecision(game: GameState, trustDelta: number): NpcDecision {
  const truthful = game.state.truth_visibility > 50 && !game.flags.accusedInstitutions.length;

  return {
    npcId: "old_secretary_daughter",
    stanceTowardPlayer: truthful ? "supportive" : "cautious",
    trustPlayerDelta: truthful ? 5 : trustDelta,
    publicResponse: truthful
      ? "老书记女儿愿意发表私人证词，但拒绝让父亲成为任何一派的旗帜。"
      : "老书记女儿要求葬礼保持尊严，不接受粗暴政治化。",
    privateContact: {
      to: truthful ? "media_editor" : "marshal",
      summary: truthful ? "讨论如何播发不属于任何一派的私人证词。" : "请求保护家属和葬礼路线。",
      motive: "保护父亲尊严，也保护自己不成为责任链上的工具。",
      outcome: "对方承诺暂不使用她的证词攻击单一部门。"
    },
    changes: [
      { variable: "public_trust", delta: truthful ? 4 : 1, reason: "家属态度影响公众对葬礼和死因的接受。" },
      { variable: "grief_temperature", delta: 2, reason: "私人记忆让哀悼从仪式变成压力。" }
    ],
    revealedClues: truthfullyRevealDaughterClue(game) ? ["clue_005"] : [],
    currentPlan: "阻止老书记被任何一派独占。"
  };
}

function physicianDecision(game: GameState, trustDelta: number): NpcDecision {
  const canSpeak = game.flags.protectedPhysician || game.player.prestige > 70 || game.state.security_power < 45;

  return {
    npcId: "chief_physician",
    stanceTowardPlayer: canSpeak ? "supportive" : "self_protective",
    trustPlayerDelta: canSpeak ? 6 : trustDelta - 3,
    publicResponse: canSpeak
      ? "总医师愿意说明医疗流程的缺口，但坚持不能把死因写成单人谋害。"
      : "总医师只承认情况复杂，要求先得到保护和专业审查程序。",
    privateContact: {
      to: canSpeak ? game.playerCharacterId : "old_secretary_daughter",
      summary: canSpeak ? "提供未签署会诊申请和护士证词摘要。" : "请求家属理解他无法直接对抗内务和各派压力。",
      motive: "保护专业伦理，也避免被当成唯一凶手。",
      outcome: canSpeak ? "医疗线索进入玩家档案。" : "医生继续保留完整病历。"
    },
    changes: [
      { variable: "truth_visibility", delta: canSpeak ? 6 : 1, reason: "医疗事实能否浮出取决于保护和威望。" }
    ],
    revealedClues: canSpeak ? ["clue_006", "clue_011"] : [],
    currentPlan: "争取专业审查，避免虚假死因。"
  };
}

function railDecision(game: GameState, trustDelta: number): NpcDecision {
  return {
    npcId: "rail_director",
    stanceTowardPlayer: game.flags.materialConcessions ? "supportive" : "cautious",
    trustPlayerDelta: game.flags.materialConcessions ? 4 : trustDelta,
    publicResponse: "铁路总局长要求所有军用和医疗运输命令有多部门签章。",
    privateContact: {
      to: game.state.worker_support > 55 ? "labor_minister" : "planning_director",
      summary: "要求配给保证和调度员免责，换取关键运输线不断。",
      motive: "保住铁路自治，避免被军务、内务或计划系统单独压制。",
      outcome: "铁路暂不全面停摆，但保留拒绝不完整命令的权利。"
    },
    changes: [
      { variable: "production", delta: game.flags.materialConcessions ? 3 : -1, reason: "铁路系统根据承诺可验证程度调整配合。" },
      { variable: "order", delta: game.flags.militaryForceMove ? -2 : 1, reason: "运输签章争议影响首都秩序。" }
    ],
    revealedClues: [],
    currentPlan: "用运输通道换取基层安全保证。"
  };
}

function mediaDecision(game: GameState, trustDelta: number): NpcDecision {
  const credible = game.flags.publicTruthLine || game.state.truth_visibility > 55;

  return {
    npcId: "media_editor",
    stanceTowardPlayer: credible ? "supportive" : "self_protective",
    trustPlayerDelta: credible ? 5 : trustDelta,
    publicResponse: credible
      ? "媒体总编准备播发系统性事故和公开调查口径。"
      : "媒体总编拒绝签署互相矛盾的讣告，要求更多证据或家属证词。",
    privateContact: {
      to: credible ? "old_secretary_daughter" : "interior_chair",
      summary: credible ? "请求家属提供能支撑公开调查的私人证词。" : "确认哪份讣告能安全播发。",
      motive: "避免成为虚假声明的签名者，同时判断谁会承担事后责任。",
      outcome: credible ? "总台保留调查口径版面。" : "总台继续保存两份互相冲突的声明。"
    },
    changes: [
      { variable: "public_trust", delta: credible ? 4 : -2, reason: "广播口径影响公众是否相信国家仍说人话。" },
      { variable: "truth_visibility", delta: credible ? 3 : 0, reason: "媒体寻找可播发的证据链。" }
    ],
    revealedClues: game.round >= 2 ? ["clue_008"] : [],
    currentPlan: "只播发能在事后站得住的文本。"
  };
}

function actingChairDecision(game: GameState, trustDelta: number): NpcDecision {
  return {
    npcId: "acting_chair",
    stanceTowardPlayer: "cautious",
    trustPlayerDelta: trustDelta,
    publicResponse: "代理主席要求一切临时安排回到主席团会议和国葬程序。",
    privateContact: {
      to: game.state.security_power > 65 ? "interior_chair" : "planning_director",
      summary: "寻求能保住法理连续性的最低共同文本。",
      motive: "避免军务或内务单独接管，也避免群众组织直接冲击主席团。",
      outcome: "主席团愿意让部分部门进入哀悼委员会，但拒绝放弃程序名义。"
    },
    changes: [
      { variable: "legitimacy", delta: 3, reason: "主席团试图恢复程序连续性。" },
      { variable: "elite_cohesion", delta: game.state.truth_visibility > 60 ? -2 : 2, reason: "法理文本能聚合一部分高层，也可能遮不住真相。" }
    ],
    revealedClues: [],
    currentPlan: "用会议和国葬程序维持共同桌面。"
  };
}

function genericDecision(
  game: GameState,
  npc: Character,
  trustDelta: number,
  pressure: boolean
): NpcDecision {
  return {
    npcId: npc.id,
    stanceTowardPlayer: pressure ? "self_protective" : "cautious",
    trustPlayerDelta: trustDelta,
    publicResponse: `${npc.display_name}暂不表态，只要求行动不要越过自身红线。`,
    privateContact: {
      to: game.playerCharacterId,
      summary: "要求确认玩家承诺是否可验证。",
      motive: "在局势清晰前保留退路。",
      outcome: "未形成正式同盟。"
    },
    changes: [],
    revealedClues: [],
    currentPlan: npc.public_position
  };
}

function truthfullyRevealDaughterClue(game: GameState): boolean {
  return game.state.truth_visibility > 45 || game.round >= 3;
}
