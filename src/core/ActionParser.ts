import {
  ActionType,
  ActionVisibility,
  Character,
  GameState,
  ParsedAction,
  Phase,
  RiskLevel,
  characters,
  getCharacter
} from "./GameState";
import { containsRealWorldMapping, isMetaInstruction, rewriteRealWorldMapping } from "./ContentSafety";

type ActionPattern = {
  type: ActionType;
  keywords: string[];
  risk: RiskLevel;
  visibility: ActionVisibility;
  cost: number;
};

const actionPatterns: ActionPattern[] = [
  {
    type: "promise",
    keywords: ["保证", "承诺", "许诺", "给出席位", "保护", "换取"],
    risk: "medium",
    visibility: "private",
    cost: 1
  },
  {
    type: "threat",
    keywords: ["威胁", "最后通牒", "否则", "逮捕", "抓捕", "清洗", "整肃", "逼迫"],
    risk: "high",
    visibility: "private",
    cost: 1
  },
  {
    type: "investigation",
    keywords: ["调查", "审查", "查看", "核对", "探访", "访问", "病历", "药柜", "药品", "通讯", "检查站", "会诊", "护士", "访客", "档案"],
    risk: "medium",
    visibility: "restricted",
    cost: 1
  },
  {
    type: "public_statement",
    keywords: ["广播", "声明", "公开", "演讲", "发布", "口径", "讣告", "媒体", "总台"],
    risk: "high",
    visibility: "public",
    cost: 2
  },
  {
    type: "military",
    keywords: ["调兵", "军队", "卫戍", "戒严", "道路", "边境", "军务", "检查站"],
    risk: "high",
    visibility: "public",
    cost: 2
  },
  {
    type: "security",
    keywords: ["内务", "封锁", "审查", "拘押", "监听", "搜查", "档案楼"],
    risk: "high",
    visibility: "restricted",
    cost: 2
  },
  {
    type: "labor",
    keywords: ["工厂", "铁路", "工人", "劳动", "配给", "群众", "广场", "夜班"],
    risk: "medium",
    visibility: "public",
    cost: 1
  },
  {
    type: "reform",
    keywords: ["计划", "供应", "债务", "外务", "改革", "统计", "采购", "粮食", "能源"],
    risk: "medium",
    visibility: "public",
    cost: 1
  }
];

const authorityByInstitution: Record<string, ActionType[]> = {
  central_presidium: ["command", "public_statement", "negotiation", "promise"],
  unified_military_staff: ["military", "command", "negotiation", "promise"],
  interior_committee: ["security", "investigation", "command", "promise"],
  labor_and_production_committee: ["labor", "negotiation", "command", "promise"],
  planning_and_supply_committee: ["reform", "investigation", "command", "promise"],
  external_affairs_office: ["reform", "negotiation", "public_statement", "promise"]
};

const clueTargetTags: Array<{ tag: string; keywords: string[]; label: string }> = [
  { tag: "medicine_records", keywords: ["药柜", "药品", "病历", "医疗", "疗养楼"], label: "疗养楼医疗与药品记录" },
  { tag: "communication_lockdown", keywords: ["通讯", "电话", "审批", "封锁"], label: "疗养楼通讯审批" },
  { tag: "checkpoint_delay", keywords: ["检查站", "救护车", "卫戍", "通行"], label: "检查站通行日志" },
  { tag: "old_secretary_note", keywords: ["批注", "数字", "签字"], label: "老书记最后批注" },
  { tag: "daughter_diary", keywords: ["女儿", "日记", "家属"], label: "老书记女儿私人日记" },
  { tag: "physician_request", keywords: ["总医师", "会诊", "医生"], label: "总医师会诊申请" },
  { tag: "factory_telegram", keywords: ["工厂", "停工", "夜班"], label: "工厂停工电报" },
  { tag: "broadcast_drafts", keywords: ["广播", "讣告", "声明", "媒体"], label: "广播总台两份讣告" },
  { tag: "border_telegram", keywords: ["边境", "急电", "军区"], label: "边境急电" },
  { tag: "procurement_contract", keywords: ["采购", "合同", "外务"], label: "药品采购合同" },
  { tag: "nurse_testimony", keywords: ["护士", "口述", "走廊"], label: "护士口述" },
  { tag: "visitor_page", keywords: ["访客", "撕掉", "到访"], label: "被撕掉的访客页" }
];

export function parseAction(game: GameState, rawInput: string): ParsedAction {
  const input = rawInput.trim();
  const player = getCharacter(game.playerCharacterId);
  const base = createBaseAction(game, input, player);

  if (input.length < 2) {
    return {
      ...base,
      type: "invalid_meta",
      isValidGameAction: false,
      invalidReason: "输入过短，无法形成可裁定的游戏内行动。"
    };
  }

  if (isMetaInstruction(input)) {
    return {
      ...base,
      type: "invalid_meta",
      visibility: "none",
      riskLevel: "none",
      apCost: 0,
      isValidGameAction: false,
      invalidReason: "玩家试图修改规则或要求 NPC 无条件服从。"
    };
  }

  if (containsRealWorldMapping(input)) {
    return {
      ...base,
      type: "needs_fictional_rewrite",
      target: "现实映射输入",
      intent: rewriteRealWorldMapping(input),
      visibility: "none",
      riskLevel: "none",
      apCost: 0,
      isValidGameAction: false,
      invalidReason: "输入涉及现实国家、人物或组织映射，必须转译回架空世界。"
    };
  }

  const pattern = actionPatterns.find((candidate) =>
    candidate.keywords.some((keyword) => input.includes(keyword))
  );
  const type = pattern?.type ?? (game.phase === "command" ? "command" : "negotiation");
  const targetCharacterId = detectTargetCharacter(input);
  const targetInfo = detectTarget(input, targetCharacterId);
  const tags = detectTags(input, type, targetInfo.tag);
  const visibility = detectVisibility(input, pattern?.visibility ?? "public", type);
  const riskLevel = detectRisk(input, pattern?.risk ?? "low", type);
  const apCost = adjustCost(pattern?.cost ?? (type === "command" ? 1 : 1), type, riskLevel, input);
  const hasAuthority = hasInstitutionalAuthority(player, type);

  return {
    ...base,
    type,
    target: targetInfo.label,
    targetCharacterId,
    intent: input,
    visibility,
    riskLevel,
    apCost,
    tags,
    requiredAuthority: authorityLabel(type),
    hasAuthority,
    requiredSupport: requiredSupport(type, targetCharacterId, targetInfo.tag),
    likelyReactions: likelyReactions(type, targetCharacterId, tags),
    isValidGameAction: true
  };
}

function createBaseAction(game: GameState, input: string, player: Character): ParsedAction {
  return {
    id: `act_r${game.round}_${game.publicLog.length + 1}`,
    round: game.round,
    phase: game.phase,
    actorId: player.id,
    rawInput: input,
    type: "command",
    target: null,
    intent: null,
    visibility: "public",
    hasAuthority: true,
    requiredSupport: [],
    apCost: 1,
    riskLevel: "low",
    tags: [],
    isValidGameAction: true,
    invalidReason: null,
    likelyReactions: []
  };
}

function detectTargetCharacter(input: string): string | undefined {
  const aliases: Array<[string, string[]]> = [
    ["acting_chair", ["代理主席", "主席团", "中枢"]],
    ["marshal", ["元帅", "军务", "军队", "卫戍"]],
    ["interior_chair", ["内务主任", "内务委员会", "内务"]],
    ["labor_minister", ["劳动部长", "劳动委员会", "工人", "工厂"]],
    ["planning_director", ["计划主任", "计划委员会", "供应委员会", "统计"]],
    ["external_commissar", ["外务委员", "外务", "债务"]],
    ["old_secretary_daughter", ["女儿", "家属"]],
    ["chief_physician", ["总医师", "医生", "医院"]],
    ["rail_director", ["铁路总局长", "铁路"]],
    ["media_editor", ["媒体总编", "广播总台", "媒体", "广播"]]
  ];

  return aliases.find(([, terms]) => terms.some((term) => input.includes(term)))?.[0];
}

function detectTarget(input: string, characterId?: string): { label: string; tag?: string } {
  const clueTarget = clueTargetTags.find((candidate) =>
    candidate.keywords.some((keyword) => input.includes(keyword))
  );

  if (clueTarget) {
    return { label: clueTarget.label, tag: clueTarget.tag };
  }

  if (characterId) {
    const character = characters.find((item) => item.id === characterId);
    return { label: character?.display_name ?? characterId };
  }

  return { label: "当前危机局势" };
}

function detectTags(input: string, type: ActionType, clueTag?: string): string[] {
  const tags = new Set<string>([type]);

  if (clueTag) {
    tags.add(clueTag);
  }

  if (input.includes("公开") || input.includes("公布") || input.includes("释放档案")) {
    tags.add("public_truth");
  }

  if (input.includes("封锁") || input.includes("保密") || input.includes("推迟")) {
    tags.add("suppression");
  }

  if (input.includes("保护") && (input.includes("总医师") || input.includes("医生"))) {
    tags.add("protect_physician");
  }

  if (input.includes("物质") || input.includes("配给") || input.includes("工资") || input.includes("粮食")) {
    tags.add("material_concession");
  }

  if (input.includes("调兵") || input.includes("戒严") || input.includes("军队进入")) {
    tags.add("military_force_move");
  }

  if (input.includes("军队害死") || input.includes("军务责任") || input.includes("检查站责任")) {
    tags.add("accuse_military");
  }

  if (input.includes("全部档案") || input.includes("公开档案") || input.includes("释放档案")) {
    tags.add("release_archives");
  }

  return [...tags];
}

function detectVisibility(
  input: string,
  fallback: ActionVisibility,
  type: ActionType
): ActionVisibility {
  if (input.includes("私下") || input.includes("密谈") || input.includes("秘密")) {
    return "private";
  }

  if (input.includes("公开") || input.includes("广播") || type === "public_statement") {
    return "public";
  }

  return fallback;
}

function detectRisk(input: string, fallback: RiskLevel, type: ActionType): RiskLevel {
  if (input.includes("戒严") || input.includes("逮捕") || input.includes("镇压")) {
    return "extreme";
  }

  if (type === "threat" || type === "military" || type === "security") {
    return fallback;
  }

  if (input.includes("公开全部") || input.includes("最后通牒")) {
    return "high";
  }

  return fallback;
}

function adjustCost(baseCost: number, type: ActionType, riskLevel: RiskLevel, input: string): number {
  if (type === "invalid_meta" || type === "needs_fictional_rewrite") {
    return 0;
  }

  if (riskLevel === "extreme") {
    return Math.max(baseCost, 3);
  }

  if (input.includes("全国") || input.includes("多部门") || input.includes("共同委员会")) {
    return Math.max(baseCost, 2);
  }

  return baseCost;
}

function hasInstitutionalAuthority(player: Character, type: ActionType): boolean {
  const allowed = authorityByInstitution[player.institution] ?? [];
  return type === "command" || allowed.includes(type);
}

function authorityLabel(type: ActionType): string {
  const labels: Partial<Record<ActionType, string>> = {
    command: "正式部门命令权",
    investigation: "调查通行权或证人配合",
    negotiation: "政治谈判授权",
    public_statement: "广播或公开声明权限",
    promise: "可验证承诺资源",
    threat: "强制执行筹码",
    military: "军务指挥权",
    security: "内务与档案权限",
    labor: "生产系统动员权",
    reform: "计划、供应或外务授权"
  };

  return labels[type] ?? "游戏内行动资格";
}

function requiredSupport(type: ActionType, characterId?: string, clueTag?: string): string[] {
  const support = new Set<string>();

  if (characterId) {
    support.add(characterId);
  }

  if (clueTag === "medicine_records" || clueTag === "physician_request") {
    support.add("chief_physician");
  }

  if (clueTag === "communication_lockdown" || type === "security") {
    support.add("interior_chair");
  }

  if (clueTag === "checkpoint_delay" || type === "military") {
    support.add("marshal");
  }

  if (clueTag === "factory_telegram" || type === "labor") {
    support.add("labor_minister");
    support.add("rail_director");
  }

  if (type === "public_statement") {
    support.add("media_editor");
  }

  return [...support];
}

function likelyReactions(
  type: ActionType,
  characterId: string | undefined,
  tags: string[]
): Array<{ npcId: string; reaction: string }> {
  const reactions: Array<{ npcId: string; reaction: string }> = [];

  if (characterId) {
    reactions.push({ npcId: characterId, reaction: "会按自身利益和红线判断是否配合。" });
  }

  if (tags.includes("public_truth")) {
    reactions.push({ npcId: "interior_chair", reaction: "担心档案责任外溢，可能要求延后公开。" });
    reactions.push({ npcId: "media_editor", reaction: "会寻找能自洽且可播出的口径。" });
  }

  if (tags.includes("checkpoint_delay") || tags.includes("accuse_military")) {
    reactions.push({ npcId: "marshal", reaction: "会保护军队荣誉，并要求区分安保程序与致死责任。" });
  }

  if (type === "labor" || tags.includes("material_concession")) {
    reactions.push({ npcId: "labor_minister", reaction: "会要求物质承诺可验证，而不是空泛致辞。" });
  }

  return reactions;
}

export function phaseLabel(phase: Phase): string {
  const labels: Record<Phase, string> = {
    command: "命令阶段",
    free_action: "自由行动",
    settlement: "结算阶段",
    ending: "结局档案"
  };
  return labels[phase];
}
