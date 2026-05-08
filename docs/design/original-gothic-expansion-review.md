# 原创黑暗哥特科幻扩展审查清单

## 版权与表达审查

- [x] 角色、卡牌、遗物、事件、敌人与音乐均使用原创命名和本地资源路径。
- [x] 没有复制第三方商业游戏代码、数据、文本、立绘、音频或资产。
- [x] 没有使用既有 IP 的专有派系名、徽记、口号、兵种轮廓组合或可识别名词系统。
- [x] `penitent_judge` 与 `void_sanctioner` 的机制通过判令、供述、封印、压制等原创路线表达。
- [x] 事件预览标签由 `src/content/narrative/numericSystem.ts` 的叙事适配层生成，`EventView.tsx` 只消费渲染。

## 敏感主题审查

- [x] 用户提到的身份、疾病、残障和心理困境只转译为“被归档、被审判、被规训、寻找自我命名、在系统压力下幸存”等尊严化主题。
- [x] 没有把 LGBT、跨性别、残障、传染病、双相、自闭、抑郁、社交障碍等标签作为怪物名、诅咒名、负面状态名或惩罚名。
- [x] 事件代价使用游戏内资源、生命值、牌库、腐化、路线承诺等抽象机制表达。
- [x] 怪物和敌对系统指向压迫性机构、失控机器、异化仪式和环境风险，不指向现实受保护身份。

## 当前登记

- 新角色：`penitent_judge`、`void_sanctioner`
- 新路线资源：判令 `verdict`、封印 `seal`
- 新 UI 标签：`commit`、`pivot`、`payoff`、`burden`、`debt`、`recovery`
- 新音乐资产：`public/assets/music/scene`、`public/assets/music/character`、`public/assets/music/event`
