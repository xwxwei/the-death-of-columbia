import { FormEvent, useMemo, useState } from "react";
import {
  debugResolveEnding,
  debugSetPrestige,
  debugSetState,
  newGame,
  runScriptedGame,
  settleRound,
  submitAction
} from "../core/GameController";
import {
  GameState,
  Phase,
  StateVariable,
  characters,
  getCharacter,
  getKnownClues,
  playableCharacters,
  stateVariableLabels
} from "../core/GameState";
import { phaseLabel } from "../core/ActionParser";

const defaultActionByPhase: Record<Phase, string> = {
  command: "命令秘书系统核对疗养楼医疗记录和通讯审批，不公开指责任何部门。",
  free_action: "私下探访总医师，承诺保护专业审查程序并调查药柜账实。",
  settlement: "",
  ending: ""
};

const orderedStateVariables: StateVariable[] = [
  "legitimacy",
  "order",
  "production",
  "public_trust",
  "elite_cohesion",
  "truth_visibility",
  "military_loyalty",
  "security_power",
  "worker_support",
  "reform_momentum",
  "foreign_pressure",
  "grief_temperature"
];

export function App() {
  const [selectedCharacterId, setSelectedCharacterId] = useState(playableCharacters[0].id);
  const [game, setGame] = useState<GameState | null>(null);

  if (!game) {
    return (
      <NewGameScreen
        selectedCharacterId={selectedCharacterId}
        onSelect={setSelectedCharacterId}
        onStart={() => setGame(newGame(selectedCharacterId))}
        onAutoRun={() => setGame(runScriptedGame(selectedCharacterId))}
      />
    );
  }

  return <GameScreen game={game} onGameChange={setGame} onRestart={() => setGame(null)} />;
}

function NewGameScreen({
  selectedCharacterId,
  onSelect,
  onStart,
  onAutoRun
}: {
  selectedCharacterId: string;
  onSelect: (characterId: string) => void;
  onStart: () => void;
  onAutoRun: () => void;
}) {
  return (
    <main className="app-shell start-shell">
      <section className="start-copy">
        <ColumbiaSeal />
        <p className="eyebrow">哥伦比亚之死 / The Death of Columbia</p>
        <h1>Columbia Is Dead. The struggle begins.</h1>
        <p className="lede">
          老书记缺席晨会。疗养楼电话转入审批。工厂夜班要求解释配给削减。
          未来 72 小时里，国家必须继承自己，也必须解释自己。
        </p>
        <div className="start-actions">
          <button onClick={onStart} type="button">
            开始危机
          </button>
          <button className="secondary" onClick={onAutoRun} type="button">
            自动跑完一局
          </button>
        </div>
      </section>

      <section className="character-grid" aria-label="角色卡">
        {playableCharacters.map((character) => (
          <button
            className={`character-card ${selectedCharacterId === character.id ? "selected" : ""}`}
            key={character.id}
            onClick={() => onSelect(character.id)}
            type="button"
          >
            <span>{character.institution}</span>
            <strong>{character.display_name}</strong>
            <em>{character.role}</em>
            <small>{character.public_position}</small>
          </button>
        ))}
      </section>
    </main>
  );
}

function GameScreen({
  game,
  onGameChange,
  onRestart
}: {
  game: GameState;
  onGameChange: (game: GameState) => void;
  onRestart: () => void;
}) {
  const [input, setInput] = useState(defaultActionByPhase[game.phase]);
  const player = getCharacter(game.playerCharacterId);
  const lastLogs = useMemo(() => [...game.publicLog].slice(-8).reverse(), [game.publicLog]);
  const knownClues = getKnownClues(game);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    const next = submitAction(game, input);
    onGameChange(next);
    setInput(defaultActionByPhase[next.phase]);
  }

  function handleSettle() {
    const next = settleRound(game);
    onGameChange(next);
    setInput(defaultActionByPhase[next.phase]);
  }

  return (
    <main className="app-shell game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">第 {game.round} 轮 / {phaseLabel(game.phase)}</p>
          <h1>哥伦比亚之死</h1>
        </div>
        <div className="topbar-actions">
          <Metric label="行动点" value={game.apUsed} />
          <Metric label="威望" value={game.player.prestige} />
          <button className="secondary" onClick={() => onGameChange(runScriptedGame(game.playerCharacterId))} type="button">
            自动推进至结局
          </button>
          <button className="ghost" onClick={onRestart} type="button">
            新局
          </button>
        </div>
      </header>

      <section className="command-band">
        <div className="player-panel">
          <ColumbiaSeal compact />
          <div>
            <p className="eyebrow">玩家角色</p>
            <h2>{player.display_name}</h2>
            <p>{player.role}</p>
          </div>
        </div>

        {game.phase === "ending" ? (
          <EndingDossier dossier={game.endingDossier ?? ""} />
        ) : (
          <form className="action-form" onSubmit={handleSubmit}>
            <label htmlFor="action-input">{game.phase === "command" ? "正式命令" : "自由行动"}</label>
            <textarea
              id="action-input"
              maxLength={1200}
              onChange={(event) => setInput(event.target.value)}
              placeholder="写下你的行动..."
              value={input}
            />
            <div className="form-actions">
              <button disabled={game.phase === "settlement" || input.trim().length < 2} type="submit">
                提交行动
              </button>
              <button className="secondary" onClick={handleSettle} type="button">
                结算本轮
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="dashboard">
        <StatePanel game={game} />
        <CrisisMap game={game} />
        <LogPanel logs={lastLogs} />
        <CluePanel clues={knownClues} />
        <NpcPanel game={game} />
        <DebugPanel game={game} onGameChange={onGameChange} />
      </section>
    </main>
  );
}

function StatePanel({ game }: { game: GameState }) {
  return (
    <section className="panel state-panel">
      <PanelHeader eyebrow="国家变量" title="结构压力" />
      <div className="state-grid">
        {orderedStateVariables.map((variable) => (
          <div className="state-row" key={variable}>
            <span>{stateVariableLabels[variable]}</span>
            <div className="bar" aria-label={`${stateVariableLabels[variable]} ${game.state[variable]}`}>
              <i style={{ width: `${game.state[variable]}%` }} />
            </div>
            <strong>{game.state[variable]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CrisisMap({ game }: { game: GameState }) {
  const nodes = [
    { id: "主席团", x: 50, y: 20, value: game.state.legitimacy },
    { id: "军务", x: 78, y: 48, value: game.state.military_loyalty },
    { id: "内务", x: 62, y: 78, value: game.state.security_power },
    { id: "劳动", x: 26, y: 66, value: game.state.worker_support },
    { id: "计划", x: 28, y: 34, value: game.state.reform_momentum }
  ];

  return (
    <section className="panel map-panel">
      <PanelHeader eyebrow="权力图" title="五个系统" />
      <svg className="crisis-map" viewBox="0 0 100 100" role="img" aria-label="哥伦比亚共同体权力系统图">
        <path d="M50 20 L78 48 L62 78 L26 66 L28 34 Z" />
        {nodes.map((node) => (
          <g key={node.id}>
            <circle cx={node.x} cy={node.y} r={6 + node.value / 18} />
            <text x={node.x} y={node.y + 1}>
              {node.id}
            </text>
          </g>
        ))}
      </svg>
      <p className="map-caption">
        广播、道路、档案、工厂和会议桌正在互相测量彼此的耐心。
      </p>
    </section>
  );
}

function LogPanel({ logs }: { logs: GameState["publicLog"] }) {
  return (
    <section className="panel log-panel">
      <PanelHeader eyebrow="公开日志" title="最近记录" />
      <div className="timeline">
        {logs.map((log) => (
          <article key={log.id}>
            <span>R{log.round} / {phaseLabel(log.phase)}</span>
            <h3>{log.title}</h3>
            <p>{log.body}</p>
            {log.relatedClues?.length ? <small>线索：{log.relatedClues.join("、")}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function CluePanel({ clues }: { clues: ReturnType<typeof getKnownClues> }) {
  return (
    <section className="panel clue-panel">
      <PanelHeader eyebrow="线索" title={`${clues.length} / 12`} />
      <div className="clue-list">
        {clues.length ? (
          clues.map(([id, clue]) => (
            <span className={clue.visibility === "public" ? "public-clue" : ""} key={id}>
              {clue.title}
            </span>
          ))
        ) : (
          <p>档案仍是空白，只有走廊里的低声确认。</p>
        )}
      </div>
    </section>
  );
}

function NpcPanel({ game }: { game: GameState }) {
  return (
    <section className="panel npc-panel">
      <PanelHeader eyebrow="NPC" title="自主判断" />
      <div className="npc-list">
        {characters
          .filter((character) => character.id !== game.playerCharacterId)
          .map((character) => (
            <article key={character.id}>
              <strong>{character.display_name}</strong>
              <span>{game.characters[character.id].stanceToPlayer}</span>
              <p>{game.characters[character.id].currentPlan}</p>
            </article>
          ))}
      </div>
    </section>
  );
}

function DebugPanel({
  game,
  onGameChange
}: {
  game: GameState;
  onGameChange: (game: GameState) => void;
}) {
  if (!import.meta.env.DEV) {
    return null;
  }

  const endingId = debugResolveEnding(game);

  return (
    <details className="panel debug-panel">
      <summary>开发调试</summary>
      <div className="debug-actions">
        <button onClick={() => onGameChange(debugSetPrestige(game, 0))} type="button">
          威望归零
        </button>
        <button
          onClick={() =>
            onGameChange(
              debugSetState(game, {
                truth_visibility: 80,
                public_trust: 75,
                elite_cohesion: 60,
                order: 55,
                worker_support: 60,
                military_loyalty: 50,
                security_power: 45
              })
            )
          }
          type="button"
        >
          和解变量
        </button>
        <span>当前判定：{endingId}</span>
      </div>
    </details>
  );
}

function EndingDossier({ dossier }: { dossier: string }) {
  return (
    <section className="dossier">
      {dossier.split("\n").map((line, index) => {
        if (line.startsWith("# ")) {
          return <h2 key={index}>{line.replace("# ", "")}</h2>;
        }

        if (line.startsWith("## ")) {
          return <h3 key={index}>{line.replace("## ", "")}</h3>;
        }

        if (line.startsWith("- ") || /^\d+\./.test(line)) {
          return <p className="dossier-list" key={index}>{line}</p>;
        }

        return line ? <p key={index}>{line}</p> : <br key={index} />;
      })}
    </section>
  );
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="panel-header">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ColumbiaSeal({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={`seal ${compact ? "compact" : ""}`} viewBox="0 0 120 120" role="img" aria-label="哥伦比亚共同体印记">
      <rect x="10" y="10" width="100" height="100" rx="8" />
      <path d="M34 82 L60 24 L86 82 Z" />
      <path d="M38 82 H82" />
      <path d="M60 24 V98" />
      <circle cx="60" cy="60" r="14" />
    </svg>
  );
}
