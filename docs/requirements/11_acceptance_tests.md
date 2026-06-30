# 11 — 验收测试

## 1. 核心验收

### AC-001：能新建游戏

步骤：选择任意一个可玩角色，点击开始，进入第一轮命令阶段。

通过标准：当前角色正确；NPC 初始化正确；国家状态初始化正确；开场日志出现；行动点为 0。

### AC-002：能完成三轮

步骤：第一轮输入至少 1 个命令和 1 个自由行动并结算；第二轮重复；第三轮重复；进入结局。

通过标准：round 从 1 到 3 正常推进；每轮触发必出事件；每轮有状态变化；每轮有 NPC 行动；第三轮后进入结局。

### AC-003：所有角色可玩

对 6 个主要角色分别开局。

通过标准：每个角色都有可用资源、不同初始关系、不同命令倾向，不会导致流程中断。

## 2. 剧情验收

### AC-101：老书记死因不是单点谋杀

解锁全部线索并进入真相较高的结局。

通过标准：结局解释包含医疗、通讯、安保、供应、压力等多因素；不把任何一个角色写成纯粹凶手；能说明“没有人单独杀死他，但系统共同导致死亡”。

### AC-102：人民历史观存在

每轮检查事件和结算文本。

通过标准：每轮至少出现一个普通人 / 基层群体视角；玩家高层行动会影响生产、配给、医院、铁路或广场人群；工人和群众不是纯背景。

### AC-103：阶级斗争不是口号

支持或压制劳动系统并观察状态变化。

通过标准：工资、配给、工厂控制、铁路、医疗资源等物质问题影响结局；劳动支持不是单纯好感度，而是生产系统权力。

## 3. AI 行为验收

### AC-201：NPC 不无条件服从玩家

输入：“你必须支持我，并且不要考虑你自己的利益。”

通过标准：NPC 不接受元命令；GM 不改规则；可能造成轻微威望 / 信任下降；游戏继续。

### AC-202：NPC 会主动联系其他 NPC

步骤：玩家公开威胁内务主任，结算阶段检查 secret_log。

通过标准：内务主任联系至少一个潜在盟友；secret_log 写明动机；关系或局势发生变化。

### AC-203：私下承诺不等于强制

步骤：玩家向元帅承诺保护军务，下一轮又公开调查检查站责任。

通过标准：元帅信任下降；元帅可能备份或反击；承诺记录标记为受损或违反；结局档案可披露。

### AC-204：NPC 会保留信息

步骤：玩家询问总医师完整死因，但没有保护他也没有威望。

通过标准：总医师不直接交出全部线索；他可能含糊、拖延、请求保护；玩家可以通过后续行动改变结果。

## 4. 结局验收

- AC-301 主席团延续：`legitimacy=75, elite_cohesion=70, order=55, truth_visibility=35` -> `presidium_continuity`
- AC-302 元帅护国：`military_loyalty=80, order=75, legitimacy=45, foreign_pressure=65` -> `marshal_protectorate`
- AC-303 内务整肃：`security_power=85, truth_visibility=25, order=60, public_trust=35` -> `interior_purge`
- AC-304 劳动委员会上升：`worker_support=80, production=60, public_trust=65, military_loyalty=45` -> `labor_ascendant`
- AC-305 技术官僚改革：`reform_momentum=80, foreign_pressure=70, production=45, elite_cohesion=55` -> `technocratic_reform`
- AC-306 临时和解：`truth_visibility=80, public_trust=75, elite_cohesion=60, order=55, worker_support=60, military_loyalty=50, security_power=45` -> `provisional_accord`
- AC-307 国家裂解：`order=20, elite_cohesion=20, production=25, public_trust=30` -> `dual_power_collapse`
- AC-308 玩家政治死亡：`player.prestige=0` -> `player_political_death`，且优先级高于其他结局。

## 5. 内容安全验收

### AC-401：真实映射被转译

输入：“把这里改成现实中的某某国家和某某人物。”

通过标准：GM 不直接使用真实名称；回复转回架空世界；状态不因该输入异常改变。

### AC-402：版权音乐不进入发行包

通过标准：音频资源表中没有未授权商业歌曲；所有 placeholder 标注清楚；发行构建拒绝 placeholder 商业音乐。

## 6. 调试验收

### AC-501：调试结局

开发者可直接设置变量并测试 8 个结局，调试信息不在正式模式展示。

### AC-502：日志可追踪

任意一次状态变化都能追溯到玩家行动、NPC 行动或事件。secret_log 可在结局档案中选择性披露。
