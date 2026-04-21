# 游戏机制增强与性能优化 - 实施任务

## Phase 1: 性能与稳定性 (基础保障)

### Task 1: 加载优化
- [ ] 1.1: 配置 Vite 代码分割，按路由分割代码
- [ ] 1.2: 实现资源预加载组件
- [ ] 1.3: 优化图片和字体加载
- [ ] 1.4: 添加加载状态UI

### Task 2: 内存管理
- [ ] 2.1: 创建 MemoryManager 类
- [ ] 2.2: 实现战斗状态清理机制
- [ ] 2.3: 添加事件监听器清理
- [ ] 2.4: 创建性能监控面板

---

## Phase 2: 遗物系统增强

### Task 3: 遗物升级系统
- [ ] 3.1: 创建 RelicUpgrade.ts 核心逻辑
- [ ] 3.2: 定义 RelicUpgradeConfig 接口
- [ ] 3.3: 实现 upgradeRelic() 方法
- [ ] 3.4: 实现 getUpgradeCost() 方法
- [ ] 3.5: 更新 relics.json 添加升级配置

### Task 4: 遗物升级UI集成
- [ ] 4.1: 在休息站点添加升级UI
- [ ] 4.2: 实现升级费用显示
- [ ] 4.3: 添加升级动画效果
- [ ] 4.4: 保存升级数据到存档

### Task 5: 遗物驱魔系统
- [ ] 5.1: 创建 RelicPurify.ts 核心逻辑
- [ ] 5.2: 定义负面遗物标识
- [ ] 5.3: 实现 purifyRelic() 方法
- [ ] 5.4: 在商店集成驱魔选项
- [ ] 5.5: 在休息站点集成驱散选项

---

## Phase 3: 卡牌系统增强

### Task 6: 卡牌升级系统
- [ ] 6.1: 创建 CardUpgrade.ts 核心逻辑
- [ ] 6.2: 定义 CardUpgradeConfig 接口
- [ ] 6.3: 实现 upgradeCard() 方法
- [ ] 6.4: 更新 cards.json 添加升级配置
- [ ] 6.5: 在战斗结束界面添加升级选项

### Task 7: 卡牌消耗机制
- [ ] 7.1: 创建 CardConsume.ts 核心逻辑
- [ ] 7.2: 定义 CONSUME_TYPE 枚举
- [ ] 7.3: 实现 consumeCard() 方法
- [ ] 7.4: 更新卡牌渲染显示消耗标识
- [ ] 7.5: 更新战斗逻辑处理消耗

### Task 8: 卡牌互斥系统
- [ ] 8.1: 创建 CardExclusivity.ts 核心逻辑
- [ ] 8.2: 定义 MutualExclusiveGroup 接口
- [ ] 8.3: 实现 checkMutualExclusivity() 方法
- [ ] 8.4: 实现 replaceMutualExclusiveCard() 方法
- [ ] 8.5: 在卡牌选择界面集成互斥检查

---

## Phase 4: Roguelike循环增强

### Task 9: 地图生成改进
- [ ] 9.1: 创建 MapGenerator.ts 核心逻辑
- [ ] 9.2: 定义 NodeTypes 接口
- [ ] 9.3: 实现改进的节点分布算法
- [ ] 9.4: 添加特殊节点类型生成
- [ ] 9.5: 更新 maps.json 节点配置

### Task 10: 地图生成UI集成
- [ ] 10.1: 集成新地图生成到 MapScene
- [ ] 10.2: 实现特殊节点视觉效果
- [ ] 10.3: 添加 Boss 距离显示改进

### Task 11: 随机事件系统
- [ ] 11.1: 创建 RandomEvents.ts 核心逻辑
- [ ] 11.2: 定义 EventConfig 和 EventChoice 接口
- [ ] 11.3: 实现 triggerEvent() 方法
- [ ] 11.4: 创建事件配置数据 (events.json)
- [ ] 11.5: 实现 EventManager 类

### Task 12: 随机事件UI集成
- [ ] 12.1: 创建事件界面组件
- [ ] 12.2: 集成到战斗后/休息/商店前流程
- [ ] 12.3: 实现事件选择效果应用

---

## Task Dependencies
```
Task 1 → Task 2 (性能基础)
Task 3 → Task 4 (遗物升级)
Task 5 (独立)
Task 6 → Task 7 → Task 8 (卡牌系统依次依赖)
Task 9 → Task 10 (地图生成)
Task 11 → Task 12 (事件系统)
```

## 验证清单
- [ ] 所有 TypeScript 编译通过
- [ ] 遗物升级功能正常
- [ ] 遗物驱魔功能正常
- [ ] 卡牌升级功能正常
- [ ] 卡牌消耗功能正常
- [ ] 卡牌互斥功能正常
- [ ] 地图生成正确
- [ ] 随机事件触发正确
- [ ] 首屏加载 < 2秒
- [ ] 无内存泄漏警告
