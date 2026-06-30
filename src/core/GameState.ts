import charactersSeed from "../data/characters.seed.json";
import endingsSeed from "../data/endings.seed.json";
import eventsSeed from "../data/events.seed.json";
import initialStateSeed from "../data/initial_state.seed.json";

export type Phase = "command" | "free_action" | "settlement" | "ending";

export type StateVariable =
  | "legitimacy"
  | "order"
  | "production"
  | "public_trust"
  | "elite_cohesion"
  | "truth_visibility"
  | "military_loyalty"
  | "security_power"
  | "worker_support"
  | "reform_momentum"
  | "foreign_pressure"
  | "grief_temperature";

export type ClueVisibility = "hidden" | "known" | "public";
export type RiskLevel = "none" | "low" | "medium" | "high" | "extreme";
export type ActionVisibility = "none" | "private" | "restricted" | "public";

export type ActionType =
  | "command"
  | "investigation"
  | "negotiation"
  | "public_statement"
  | "promise"
  | "threat"
  | "military"
  | "security"
  | "labor"
  | "reform"
  | "invalid_meta"
  | "needs_fictional_rewrite";

export type ResolutionLevel =
  | "success"
  | "success_with_cost"
  | "partial"
  | "delayed"
  | "failure"
  | "backlash"
  | "invalid";

export interface Character {
  id: string;
  display_name: string;
  role: string;
  playable: boolean;
  institution: string;
  public_position: string;
  private_motives: string[];
  resources: string[];
  red_lines: string[];
  initial_prestige: number;
  weights: Record<string, number>;
  initial_relationships?: Record<string, number>;
}

export interface StoryEvent {
  id: string;
  round: 1 | 2 | 3;
  title: string;
  description: string;
  required: boolean;
  trigger_conditions?: Record<string, string | number | boolean>;
  unlocks_clues?: string[];
  effects: StateChange[];
}

export interface Ending {
  id: EndingId;
  title: string;
  priority: number;
  conditions: Record<string, number>;
  summary: string;
  costs: string[];
  player_evaluation: string;
}

export type EndingId =
  | "player_political_death"
  | "dual_power_collapse"
  | "interior_purge"
  | "marshal_protectorate"
  | "labor_ascendant"
  | "technocratic_reform"
  | "provisional_accord"
  | "presidium_continuity";

export interface StateChange {
  variable: StateVariable | "player.prestige" | "relationship" | "promise";
  delta: number;
  reason: string;
  target?: string;
}

export interface ClueState {
  title: string;
  visibility: ClueVisibility;
  discoveredRound?: number;
  source?: string;
}

export interface CharacterRuntime {
  id: string;
  prestige: number;
  stanceToPlayer: "supportive" | "cautious" | "hostile" | "self_protective";
  currentPlan: string;
  knownClues: string[];
}

export interface ParsedAction {
  id: string;
  round: number;
  phase: Phase;
  actorId: string;
  rawInput: string;
  type: ActionType;
  target: string | null;
  targetCharacterId?: string;
  intent: string | null;
  visibility: ActionVisibility;
  requiredAuthority?: string;
  hasAuthority: boolean;
  requiredSupport: string[];
  apCost: number;
  riskLevel: RiskLevel;
  tags: string[];
  isValidGameAction: boolean;
  invalidReason: string | null;
  likelyReactions: Array<{ npcId: string; reaction: string }>;
}

export interface ActionResolution {
  action: ParsedAction;
  level: ResolutionLevel;
  score: number;
  summary: string;
  changes: StateChange[];
  unlockedClues: string[];
}

export interface LogEntry {
  id: string;
  round: number;
  phase: Phase;
  type: "opening" | "player_action" | "event" | "settlement" | "npc" | "system" | "ending";
  title: string;
  body: string;
  changes?: StateChange[];
  relatedClues?: string[];
  action?: ParsedAction;
}

export interface SecretLogEntry {
  id: string;
  round: number;
  from: string;
  to: string;
  summary: string;
  motive: string;
  outcome: string;
  visibleToPlayer: boolean;
}

export interface PromiseRecord {
  promiseId: string;
  round: number;
  from: string;
  to: string;
  content: string;
  visibility: "private" | "public";
  credibility: number;
  verification: string;
  breachPenalty: {
    relationship: number;
    prestige: number;
  };
  status: "pending" | "kept" | "strained" | "broken";
}

export interface GameFlags {
  investigatedTargets: string[];
  threatenedNpcIds: string[];
  accusedInstitutions: string[];
  protectedPhysician: boolean;
  publicTruthLine: boolean;
  materialConcessions: boolean;
  militaryForceMove: boolean;
  releasedArchives: boolean;
  controlledBroadcast: string | null;
  invalidInputCount: number;
}

export interface GameState {
  saveVersion: number;
  gameId: string;
  createdAt: string;
  round: 1 | 2 | 3;
  phase: Phase;
  playerCharacterId: string;
  state: Record<StateVariable, number>;
  player: {
    prestige: number;
  };
  characters: Record<string, CharacterRuntime>;
  relationships: Record<string, Record<string, number>>;
  clues: Record<string, ClueState>;
  apUsed: number;
  publicLog: LogEntry[];
  secretLog: SecretLogEntry[];
  promises: PromiseRecord[];
  triggeredEventIds: string[];
  commandCountThisRound: number;
  lastAction?: ParsedAction;
  lastResolution?: ActionResolution;
  flags: GameFlags;
  endingId?: EndingId;
  endingDossier?: string;
}

export const characters = charactersSeed as unknown as Character[];
export const events = eventsSeed as unknown as StoryEvent[];
export const endings = endingsSeed as unknown as Ending[];

export const playableCharacters = characters.filter((character) => character.playable);

export const stateVariableLabels: Record<StateVariable, string> = {
  legitimacy: "合法性",
  order: "秩序",
  production: "生产",
  public_trust: "群众信任",
  elite_cohesion: "精英团结",
  truth_visibility: "真相可见度",
  military_loyalty: "军务忠诚",
  security_power: "内务权力",
  worker_support: "劳动支持",
  reform_momentum: "改革动能",
  foreign_pressure: "外部压力",
  grief_temperature: "哀悼温度"
};

export function createInitialGame(playerCharacterId: string): GameState {
  const playerCharacter = characters.find((character) => character.id === playerCharacterId);

  if (!playerCharacter?.playable) {
    throw new Error(`Unknown playable character: ${playerCharacterId}`);
  }

  const relationships: Record<string, Record<string, number>> = {};
  const characterRuntime: Record<string, CharacterRuntime> = {};

  for (const character of characters) {
    relationships[character.id] = {};
    characterRuntime[character.id] = {
      id: character.id,
      prestige: character.initial_prestige,
      stanceToPlayer: character.id === playerCharacterId ? "supportive" : "cautious",
      currentPlan: character.public_position,
      knownClues: []
    };
  }

  for (const character of characters) {
    for (const [targetId, value] of Object.entries(character.initial_relationships ?? {})) {
      relationships[character.id][targetId] = value;
      relationships[targetId] = relationships[targetId] ?? {};
      relationships[targetId][character.id] = relationships[targetId][character.id] ?? value;
    }
  }

  const gameId = `game_${Date.now().toString(36)}_${playerCharacterId}`;

  return {
    saveVersion: initialStateSeed.save_version,
    gameId,
    createdAt: new Date().toISOString(),
    round: 1,
    phase: "command",
    playerCharacterId,
    state: clampState({ ...(initialStateSeed.state as Record<StateVariable, number>) }),
    player: {
      prestige: playerCharacter.initial_prestige
    },
    characters: characterRuntime,
    relationships,
    clues: clone(initialStateSeed.clues) as Record<string, ClueState>,
    apUsed: initialStateSeed.ap_used,
    publicLog: [
      {
        id: `${gameId}_opening`,
        round: 1,
        phase: "command",
        type: "opening",
        title: "开局档案",
        body:
          "老书记缺席晨会，疗养楼传出含糊消息。各部门仍在按旧流程运转，但每个人都在确认同一件事：那支能签字的手还会不会出现。",
        changes: []
      }
    ],
    secretLog: [],
    promises: [],
    triggeredEventIds: [],
    commandCountThisRound: 0,
    flags: {
      investigatedTargets: [],
      threatenedNpcIds: [],
      accusedInstitutions: [],
      protectedPhysician: false,
      publicTruthLine: false,
      materialConcessions: false,
      militaryForceMove: false,
      releasedArchives: false,
      controlledBroadcast: null,
      invalidInputCount: 0
    }
  };
}

export function cloneGame(game: GameState): GameState {
  return clone(game) as GameState;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function clampState(state: Record<StateVariable, number>): Record<StateVariable, number> {
  const next = { ...state };
  for (const variable of Object.keys(next) as StateVariable[]) {
    next[variable] = clamp(next[variable]);
  }
  return next;
}

export function getCharacter(characterId: string): Character {
  const character = characters.find((item) => item.id === characterId);

  if (!character) {
    throw new Error(`Unknown character: ${characterId}`);
  }

  return character;
}

export function getRelationship(game: GameState, from: string, to: string): number {
  return game.relationships[from]?.[to] ?? game.relationships[to]?.[from] ?? 0;
}

export function setRelationship(game: GameState, from: string, to: string, value: number): void {
  game.relationships[from] = game.relationships[from] ?? {};
  game.relationships[to] = game.relationships[to] ?? {};
  game.relationships[from][to] = clamp(value, -100, 100);
  game.relationships[to][from] = clamp(value, -100, 100);
}

export function adjustRelationship(
  game: GameState,
  from: string,
  to: string,
  delta: number
): number {
  const next = getRelationship(game, from, to) + delta;
  setRelationship(game, from, to, next);
  return getRelationship(game, from, to);
}

export function pushLog(game: GameState, entry: Omit<LogEntry, "id">): LogEntry {
  const logEntry: LogEntry = {
    id: `log_${game.publicLog.length + 1}_${Date.now().toString(36)}`,
    ...entry
  };
  game.publicLog.push(logEntry);
  return logEntry;
}

export function pushSecretLog(
  game: GameState,
  entry: Omit<SecretLogEntry, "id">
): SecretLogEntry {
  const logEntry: SecretLogEntry = {
    id: `secret_${game.secretLog.length + 1}_${Date.now().toString(36)}`,
    ...entry
  };
  game.secretLog.push(logEntry);
  return logEntry;
}

export function revealClue(
  game: GameState,
  clueId: string,
  visibility: ClueVisibility = "known",
  source = "行动或事件"
): boolean {
  const clue = game.clues[clueId];

  if (!clue) {
    return false;
  }

  const wasHidden = clue.visibility === "hidden";
  clue.visibility = visibility === "public" || clue.visibility === "public" ? "public" : "known";
  clue.discoveredRound = clue.discoveredRound ?? game.round;
  clue.source = clue.source ?? source;
  return wasHidden;
}

export function getKnownClues(game: GameState): Array<[string, ClueState]> {
  return Object.entries(game.clues).filter(([, clue]) => clue.visibility !== "hidden");
}

export function applyStateChange(game: GameState, change: StateChange): void {
  if (change.variable === "player.prestige") {
    game.player.prestige = clamp(game.player.prestige + change.delta);
    game.characters[game.playerCharacterId].prestige = game.player.prestige;
    return;
  }

  if (change.variable === "relationship" || change.variable === "promise") {
    return;
  }

  game.state[change.variable] = clamp(game.state[change.variable] + change.delta);
}
