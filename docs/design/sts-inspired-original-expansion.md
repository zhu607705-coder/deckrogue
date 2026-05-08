# DeckRogue 原创机制转译说明

## 目标

本扩展只吸收成熟卡牌构筑游戏的通用设计经验：路线提交、风险收益、商店取舍、事件代价、敌人意图节奏与长局回归。所有落地内容必须转写为 DeckRogue 自有的教堂工业、黑暗哥特科幻语境。

## 合规边界

- 不复制、不解包、不反编译第三方商业游戏代码、数据、文本、立绘、音频或其他资产。
- 不使用既有 IP 的专有派系名、徽记、口号、兵种轮廓组合、标志性圣像组合或可识别名词系统。
- 机制只能以抽象规则迁移，例如“高风险事件后置结算”“商店给出路线支撑”“敌人用可读意图施压”。
- 表达必须使用原创命名、原创数值、原创事件文本、原创图片和原创音乐。

## 本地化方向

- 核心氛围：残存教堂、审判机关、工业圣所、静默档案、反应堆礼拜堂、虚空封印。
- 角色路线：`penitent_judge` 使用判令、供述、处刑；`void_sanctioner` 使用封印、压制、代价。
- 商店与事件：由内容层或叙事适配层给出路线提示、代价提示和长期影响，UI 只渲染适配结果。
- 敌人机制：强调可读意图、阶段压迫、资源试探和防御窗口，避免照搬任何具体敌人脚本。

## 验收门

- 内容契约：`npm run check:content-contract-layer`
- 内容包：`npm run check:content-bundle`
- 8 角色路线：`npm run check:shop-event-growth-nodes` 与 `npm run check:route-taxonomy-guardrails`
- 表达审查：`docs/design/original-gothic-expansion-review.md`
- 补充回归：`npm run test:supplemental-units`、`npm run accept:expansion-content`
