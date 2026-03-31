# 当前版本定义

## 冻结线
- 本版本只允许：
  - 修 bug
  - 修 UI 表达
  - 修数值
- 本版本不允许：
  - 新卡牌机制
  - 核心结算模型变更
  - 新大系统
  - 新章节
  - 新模式
  - 新入口

## 当前版本真值
- 角色数：`6`
- 章节数：`3`
- 地图节点类型：
  - `Combat`
  - `Elite`
  - `Event`
  - `Shop`
  - `Rest`
  - `Boss`

## 当前允许的核心流派
- `informant`: 控制 / intel / evidence
- `brute`: 受伤爆发 / rage
- `tactician`: 格挡调度 / command
- `puppeteer`: 召唤 / thread
- `chronomancer`: 延迟 / timeLayer
- `alchemist`: poison / element / concoction

## 明确留到下个版本
- 新卡牌机制
- 核心结算模型变更
- 新大系统
- 新章节 / 新模式 / 新入口

## 发版否决条件
- 存在可稳定复现的死循环或崩溃
- 存在一套明显碾压其他路线的构筑
- 新玩家第一局频繁看不懂卡牌或敌人意图
- 极端情况下战斗结算顺序不一致
- 打包版和开发版行为不一致
