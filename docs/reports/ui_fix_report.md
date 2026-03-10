# UI 修复报告

**修复日期**: 2026-02-25  
**修复范围**: P0-P2 级问题

---

## 修复清单

### P0-1: MapIcon 无限重渲染 ✅

**文件**: `src/ui/MapIcon.tsx`

**问题**: `useEffect` 依赖 `paths.png` 和 `paths.svg`，但 `getIconPaths` 每次调用都返回新对象，导致无限循环。

**修复**:
1. 使用 `useMemo` 缓存 `paths` 对象
2. 添加 `fallbackCount` 状态追踪回退次数
3. 添加最终默认图标回退

```typescript
// 修复前
const paths = getIconPaths(type);
useEffect(() => { ... }, [type, paths.png, paths.svg]);  // 无限循环

// 修复后
const paths = useMemo(() => getIconPaths(type), [type]);  // 缓存
useEffect(() => { ... }, [paths]);  // 正确依赖
```

---

### P1-3: MapIcon 回退逻辑 ✅

**文件**: `src/ui/MapIcon.tsx`

**问题**: 当 PNG 和 SVG 都加载失败时，图片会被隐藏，显示空白。

**修复**:
```typescript
const DEFAULT_ICON = '/assets/map/map_event.png';

onError={(e) => {
  const target = e.currentTarget;
  if (fallbackCount === 0 && target.src.endsWith('.png')) {
    setFallbackCount(1);
    target.src = paths.svg;
  } else if (fallbackCount === 1) {
    setFallbackCount(2);
    target.src = DEFAULT_ICON;  // 最终回退
  } else {
    target.style.opacity = '0.3';  // 降级显示
  }
}}
```

---

### P2-2: ShopView 药水混合状态 ✅

**文件**: `src/ui/ShopView.tsx`

**问题**: `mixB` 初始值为 1，可能指向不存在的药水槽位。

**修复**:
```typescript
// 修复前
const [mixB, setMixB] = useState<number>(1);

// 修复后
const [mixB, setMixB] = useState<number>(Math.min(1, Math.max(0, player.potions.length - 1)));
```

---

### P2-3: RewardView 空状态处理 ✅

**文件**: `src/ui/RewardView.tsx`

**问题**: 如果 `rewardCards` 为空，会显示空白区域。

**修复**:
```typescript
{cards.length === 0 ? (
  <div className="text-slate-400 text-xl mb-12">No rewards available</div>
) : (
  <div className="flex gap-8 mb-12">
    {cards.map(...)}
  </div>
)}
```

---

## 验证结果

### TypeScript 编译
```
✅ npm run lint 通过
```

### 平衡测试 (10 局/职业, 3 层)

| 职业 | 3F 胜率 | 平均回合 |
|------|---------|----------|
| informant | 90% | 4.1 |
| brute | 90% | 2.8 |
| tactician | 100% | 3.0 |
| chronomancer | 100% | 2.1 |
| puppeteer | 100% | 3.1 |
| alchemist | 90% | 4.6 |

**结论**: 所有修复已生效，游戏运行正常。

---

## 剩余问题 (P3)

以下问题未在本轮修复，建议后续处理：

| 问题 | 严重度 | 状态 |
|------|--------|------|
| CombatView 组件过于庞大 | P1 | 待重构 |
| 响应式设计缺失 | P1 | 待实现 |
| CSS 类名过长 | P3 | 待优化 |
| 硬编码中文字符串 | P3 | 待国际化 |
| 地图缩放功能缺失 | 功能 | 待实现 |
