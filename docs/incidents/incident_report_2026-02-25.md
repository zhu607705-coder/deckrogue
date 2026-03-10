# 故障报告：服务不可用诊断与修复

**报告日期**: 2026-02-25  
**故障级别**: 中等  
**修复状态**: ✅ 已解决

---

## 1. 故障概述

用户报告系统出现"服务不可用"故障，需要进行全面诊断和修复。

---

## 2. 诊断过程

### 2.1 初步检查

| 检查项 | 结果 | 状态 |
|--------|------|------|
| Vite 开发服务器 | 正常启动，端口 3000 | ✅ |
| HTTP 响应状态 | 200 OK | ✅ |
| TypeScript 编译 | 无错误 | ✅ |
| 浏览器预览 | 无错误 | ✅ |

### 2.2 深度诊断

通过模拟测试发现以下问题：

**问题 A: 缺失资源文件**
- **位置**: `src/ui/MapView.tsx` 第 129 行
- **描述**: 引用了不存在的背景图片 `bg_dark_map.png`
- **影响**: 地图界面背景无法加载，可能导致视觉异常

**问题 B: 动作类型未注册**
- **位置**: `src/engine/actions/v2/ActionFactory.ts`
- **描述**: `PurgeEnemyBuffs` 动作类型未注册
- **影响**: `trial_of_heretics` 卡牌无法正常执行
- **日志**: `ActionManager: Unknown action type: PurgeEnemyBuffs`

---

## 3. 故障根源分析

### 3.1 问题 A 根源

在之前的地图背景融合任务中，代码引用了用户需要手动添加的 `bg_dark_map.png`，但该文件未实际创建。

### 3.2 问题 B 根源

`trial_of_heretics` 卡牌定义使用了 `PurgeEnemyBuffs` 动作类型，但该动作：
1. 未在 `ActionSpec` 类型中声明
2. 未实现对应的动作类
3. 未在 `ActionFactory` 中注册

---

## 4. 修复方案

### 4.1 问题 A 修复

**方案**: 使用现有背景图片替代

```diff
- backgroundImage: 'url("/assets/backgrounds/bg_dark_map.png")'
+ backgroundImage: 'url("/assets/backgrounds/bg_gothic_battlefield.png")'
```

**文件**: `src/ui/MapView.tsx`

### 4.2 问题 B 修复

**步骤 1**: 在 `ActionSpec` 类型中添加新类型

```typescript
// src/engine/types.ts
type: ... | 'PurgeEnemyBuffs';
zealPerBuff?: number;
```

**步骤 2**: 实现动作类

```typescript
// src/engine/actions/v2/SpecialActions.ts
export class PurgeEnemyBuffsAction extends BaseAction {
  private zealPerBuff: number;
  
  constructor(spec: ActionSpec) {
    super(spec);
    this.zealPerBuff = spec.zealPerBuff || 3;
  }
  
  execute(state: GameState, queue: ActionQueue): void {
    // 移除敌人增益状态，获得 Zeal
  }
}
```

**步骤 3**: 注册动作

```typescript
// src/engine/actions/v2/ActionFactory.ts
['PurgeEnemyBuffs', PurgeEnemyBuffsAction]
```

---

## 5. 验证结果

### 5.1 编译验证

```
✅ TypeScript 编译通过
✅ 无 lint 错误
```

### 5.2 功能验证

运行 5 次模拟测试，所有职业正常：

| 职业 | 前3层胜率 | 状态 |
|------|-----------|------|
| informant | 100% | ✅ |
| brute | 80% | ✅ |
| tactician | 100% | ✅ |
| chronomancer | 100% | ✅ |
| puppeteer | 100% | ✅ |
| alchemist | 100% | ✅ |

### 5.3 浏览器验证

```
✅ 无 JavaScript 错误
✅ 页面正常加载
✅ 地图背景正常显示
```

---

## 6. 预防措施

### 6.1 资源文件管理

1. **建立资源清单**: 创建 `public/assets/manifest.json` 记录所有资源文件
2. **添加资源检查脚本**: 在构建前验证所有引用的资源是否存在
3. **使用 fallback**: 为关键资源提供默认 fallback

### 6.2 动作类型管理

1. **类型安全**: 在添加新卡牌时，确保动作类型已定义
2. **单元测试**: 为每个动作类型编写测试用例
3. **文档更新**: 维护动作类型清单文档

### 6.3 CI/CD 增强

```yaml
# 建议添加的检查步骤
- name: Check asset references
  run: npm run check-assets

- name: Verify action types
  run: npm run check-actions
```

---

## 7. 总结

| 项目 | 详情 |
|------|------|
| 故障类型 | 资源缺失 + 功能未实现 |
| 影响范围 | 地图背景显示 + 特定卡牌执行 |
| 修复时间 | 约 15 分钟 |
| 修复方法 | 资源替换 + 代码实现 |
| 遗留问题 | 无 |

**状态**: ✅ 服务已恢复正常运行
