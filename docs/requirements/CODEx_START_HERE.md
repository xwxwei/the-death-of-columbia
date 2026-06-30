# Codex Start Here

你要实现的是《哥伦比亚之死》的 MVP 剧情引擎。

## 先读这些文件

1. `README.md`
2. `00_mvp_scope.md`
3. `03_story_structure.md`
4. `04_game_mechanics.md`
5. `06_ai_agent_rules.md`
6. `08_endings.md`
7. `09_technical_architecture.md`
8. `11_acceptance_tests.md`

## 第一阶段只做这些

- 加载 `seed_data/*.json`
- 新建游戏
- 选择玩家角色
- 跑三轮
- 玩家可输入行动
- mock NPC 决策
- mock GM 结算
- 能进入 8 个结局
- 输出结局档案

## 不要先做这些

- 美术
- 支付
- 多人
- 语音
- Steam 成就
- iCloud
- 真正复杂经济系统

## 实现优先级

1. 类型定义。
2. 状态初始化。
3. ActionParser。
4. RuleEngine。
5. EventEngine。
6. NPCAgentRunner。
7. EndingResolver。
8. DossierGenerator。
9. 最小 UI。
10. 测试。

## 关键行为

NPC 不应无条件服从玩家。玩家的私下保证只是承诺记录，不是强制效果。老书记死亡真相必须是多因素系统性死亡。政治死亡是有效结局。所有现实映射都要转译为架空表达。
