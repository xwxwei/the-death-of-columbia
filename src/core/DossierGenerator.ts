import {
  Ending,
  GameState,
  characters,
  getCharacter,
  getKnownClues,
  stateVariableLabels
} from "./GameState";

const truthFactors = [
  "身体基础风险：长期心脏病、高血压和睡眠不足让死亡具有自然基础。",
  "医疗流程：总医师迟疑，未签署的会诊申请没有及时突破程序。",
  "通讯封锁：疗养楼外线被审批流程拖住，外部专家和证词流动被延迟。",
  "安保延误：检查站和卫戍程序没有单独杀死老书记，却让救护和药品抵达更慢。",
  "供应错配：药品台账与实物不一致，替代药效不足。",
  "危机压力：工厂、边境、债务、粮食和继承文件同时压到病房门口。"
];

export function generateDossier(game: GameState, ending: Ending): string {
  const knownClues = getKnownClues(game);
  const revealedSecrets = game.secretLog.slice(0, Math.max(5, Math.min(game.secretLog.length, 8)));

  return [
    `# 结局：${ending.title}`,
    "",
    "## 最后一份声明",
    ending.summary,
    "",
    "## 谁继承了哥伦比亚",
    inheritanceText(ending.id),
    "",
    "## 老书记为何而死",
    truthText(game),
    "",
    "## 普通人的第三天",
    ordinaryPeopleText(game),
    "",
    "## 你的结局",
    `${getCharacter(game.playerCharacterId).display_name}：${ending.player_evaluation}。${playerOutcomeText(game)}`,
    "",
    "## 已知线索",
    knownClues.length > 0
      ? knownClues.map(([id, clue]) => `- ${id}：${clue.title}（${clue.visibility}）`).join("\n")
      : "- 没有形成可靠线索链。",
    "",
    "## 未公开档案",
    revealedSecrets.length > 0
      ? revealedSecrets
          .map(
            (log, index) =>
              `${index + 1}. ${getCharacter(log.from).display_name} -> ${getCharacter(log.to).display_name}：${log.summary}；动机：${log.motive}；结果：${log.outcome}`
          )
          .join("\n")
      : "1. 没有足够秘密日志可披露。",
    "",
    "## NPC 最终立场",
    characters
      .filter((character) => character.id !== game.playerCharacterId)
      .map((character) => {
        const runtime = game.characters[character.id];
        return `- ${character.display_name}：${runtime.stanceToPlayer}；${runtime.currentPlan}`;
      })
      .join("\n"),
    "",
    "## 状态总结",
    Object.entries(stateVariableLabels)
      .map(([variable, label]) => `- ${label}：${game.state[variable as keyof GameState["state"]]}`)
      .join("\n"),
    `- 玩家威望：${game.player.prestige}`,
    `- 行动点消耗：${game.apUsed}`
  ].join("\n");
}

function inheritanceText(endingId: Ending["id"]): string {
  const map: Record<Ending["id"], string> = {
    player_political_death: "玩家出局后，剩余 NPC 围绕空出的责任位置重新结盟；国家并不因你的离场而停止计算。",
    dual_power_collapse: "没有单一继承者。主席团、军务、劳动系统和内务分别控制国家机器的一部分。",
    interior_purge: "内务委员会掌握档案、证人和恐惧，主席团成为合法性外壳。",
    marshal_protectorate: "军务部掌握道路、广播楼和安全节点，主席团保留形式名义。",
    labor_ascendant: "生产与劳动系统进入临时委员会，工厂、铁路和医院代表获得政治席位。",
    technocratic_reform: "计划与外务系统以供应、债务和药品渠道为杠杆推动过渡改革。",
    provisional_accord: "主席团、军务、劳动、计划、内务、家属和媒体被迫在临时共同委员会中共存。",
    presidium_continuity: "主席团主持国葬和过渡会议，各系统保留权力但接受集体领导文本。"
  };

  return map[endingId];
}

function truthText(game: GameState): string {
  const clueCount = getKnownClues(game).length;

  if (game.state.truth_visibility >= 70 || clueCount >= 8) {
    return [
      "结论不是单点谋杀。没有一个角色以杀死老书记为主要目的，但多个系统共同把他推过了临界线：",
      truthFactors.map((factor) => `- ${factor}`).join("\n"),
      "档案上的准确表述应是：没有人单独杀死他，但系统共同导致死亡。"
    ].join("\n");
  }

  if (game.state.truth_visibility >= 40 || clueCount >= 4) {
    return "档案显示死亡不只是疾病，也不只是阴谋。医疗、通讯、安保、供应和压力至少有三条链条互相叠加，但公开文本仍回避了完整责任。";
  }

  return "公开版本仍倾向于长期疾病和劳累。医疗、通讯、安保、供应与压力的系统性关系没有被充分承认。";
}

function ordinaryPeopleText(game: GameState): string {
  if (game.state.worker_support >= 65 && game.state.production >= 55) {
    return "铁路班组维持最低运转，工厂代表进入哀悼和供应监督。配给队伍仍长，但普通人第一次被要求作为政治主体发言。";
  }

  if (game.state.order <= 35 || game.state.production <= 35) {
    return "第三天清晨，配给站先于主席团失去耐心。铁路停开，医院改用手写名单，广场人群开始相信每份广播都只是另一派的命令。";
  }

  return "普通人得到一套暂时能听懂的解释，却仍要在工厂、铁路、医院和配给站里承担旧系统留下的缺口。";
}

function playerOutcomeText(game: GameState): string {
  if (game.player.prestige <= 0) {
    return "你的名字进入责任链，成为别人恢复秩序时最便宜的解释。";
  }

  if (game.player.prestige >= 70) {
    return "你仍在权力桌边，但每一份承诺都带着见证人。";
  }

  return "你保住了行动资格，却没有保住所有人的信任。";
}
