# 09 — 技术架构建议

## 1. 核心原则

本项目核心不是 UI，而是可复用的叙事引擎。必须把剧本数据层、状态机层、行动裁定层、NPC 决策层、AI 模型适配层、客户端 UI 层、存档 / 日志层、计费 / 行动点层分开。不要把剧情结算写死在页面组件里。

## 2. 推荐 MVP 架构

```text
Client
  -> GameController
      -> GameStateStore
      -> ActionParser
      -> RuleEngine
      -> GMAdjudicator
      -> NPCAgentRunner
      -> EventEngine
      -> EndingResolver
      -> DossierGenerator
      -> ModelAdapter
  -> Persistence
```

## 3. 模块说明

### 3.1 GameStateStore

保存当前轮次、国家变量、角色变量、关系矩阵、公开日志、秘密日志、线索可见度、承诺记录、行动点消耗。

### 3.2 ActionParser

将玩家自然语言输入转为结构化行动；判断是否为命令、调查、私聊、公开发言、异常输入；提取目标、意图、风险、成本。

### 3.3 RuleEngine

计算行动基础成功率；判断职权、资源、状态变化；处理威望、关系、国家变量。

### 3.4 GMAdjudicator

调用 AI GM 生成叙事结果，但 AI GM 必须受结构化状态约束，不允许 AI 自己发明关键状态。

### 3.5 NPCAgentRunner

每轮为每个 NPC 生成命令和私聊；根据 NPC 决策规则判断联系对象；记录秘密日志；更新关系与承诺。

### 3.6 EventEngine

触发必出事件、条件事件、线索解锁和事件后果。

### 3.7 EndingResolver

根据状态变量和优先级判断结局，生成 ending_id。

### 3.8 DossierGenerator

生成结局档案、披露部分秘密日志、汇总 NPC 决策、展示老书记死因的玩家版本与真实版本差距。

### 3.9 ModelAdapter

抽象不同模型供应商；支持便宜模型和高质量模型切换；记录 token 使用量；与行动点系统连接；支持重试和降级。

## 4. 数据优先

所有剧情配置尽量来自 JSON / YAML / Markdown：角色、事件、线索、结局、提示词、状态变量、行动类型、禁用词表、文本模板。这样 Codex 可以先实现无 UI 的可运行核心，再接不同客户端。

## 5. 建议实现顺序

### Phase 1：本地可跑通

使用 seed_data；命令行或简单 Web UI；不接真实模型也可用 mock model；能完成三轮和结局判定。

### Phase 2：AI 接入

接入 ModelAdapter；GM 负责叙事化；NPC 负责自主决策；结构化状态仍由 RuleEngine 约束。

### Phase 3：客户端产品化

iOS / Steam 客户端读取同一套核心状态；添加存档、历史记录、档案视图；添加行动点展示；添加视觉设计。

### Phase 4：商业化

行动点充值、成本监控、模型路由、内容审核、商店页面、成就和云存档。

## 6. 技术栈建议

MVP 文档不强行绑定唯一技术栈。核心建议：

- 剧情引擎使用 TypeScript 或 Swift 中的纯逻辑模块均可。
- 若优先 Codex 快速产出和跨端服务，TypeScript 更容易迭代。
- 若优先 iOS 原生体验，Swift / SwiftUI 客户端可调用同一后端引擎。
- 若优先 Steam + iOS 同时发版，可考虑 Unity / Godot 做客户端，但剧情核心仍不要写死在引擎脚本里。
- 后端可用 Cloudflare Workers / Pages / D1 / R2 等轻量方案承载模型调用和存档。
- 模型供应商通过 ModelAdapter 抽象，不要硬编码单一供应商。

## 7. 建议文件结构

```text
src/
  core/
    GameController.ts
    GameState.ts
    StateStore.ts
    RuleEngine.ts
    ActionParser.ts
    EventEngine.ts
    EndingResolver.ts
    DossierGenerator.ts
  agents/
    GMAdjudicator.ts
    NPCAgent.ts
    NPCAgentRunner.ts
    ModelAdapter.ts
    MockModelAdapter.ts
  data/
    characters.seed.json
    events.seed.json
    endings.seed.json
  prompts/
    gm_system_prompt.md
    npc_system_prompt.md
    adjudicator_prompt.md
  ui/
    App.tsx
    NewGameScreen.tsx
    GameScreen.tsx
    CharacterSheet.tsx
    StatePanel.tsx
    LogPanel.tsx
    EndingScreen.tsx
tests/
  endingResolver.test.ts
  ruleEngine.test.ts
  npcDecision.test.ts
  fullRun.test.ts
```

## 8. 存档格式

```json
{
  "save_version": 1,
  "game_id": "uuid",
  "created_at": "iso_datetime",
  "round": 2,
  "phase": "free_action",
  "player_character_id": "acting_chair",
  "state": {},
  "characters": {},
  "relationships": {},
  "known_clues": [],
  "public_log": [],
  "secret_log": [],
  "promises": [],
  "ap_used": 12
}
```

## 9. 调试模式

MVP 必须提供调试功能：设置国家变量、设置玩家威望、解锁线索、直接跳到某轮、强制触发结局判定、查看 NPC 秘密日志、查看 action parser 结果。调试模式只用于开发，不在正式版默认展示。

## 10. 日志要求

每次玩家输入后记录：原始输入、解析后的行动、消耗行动点、GM 裁定、状态变化、NPC 反应、新线索、是否触发事件。日志是调试 AI 叙事一致性的关键。
