# 软件安全治理规范

## 1. 渐进式安全治理策略

### 1.1 新代码安全规范

所有新开发代码必须集成并使用指定的安全工具库进行安全相关操作，禁止直接使用原生API处理敏感操作。

#### 安全工具库

| 工具库 | 用途 | 文件路径 |
|--------|------|----------|
| `safeArray.ts` | 数组访问边界检查 | `src/core/utils/safeArray.ts` |
| `safeObject.ts` | 对象属性可选链访问 | `src/core/utils/safeObject.ts` |
| `safeStorage.ts` | localStorage 异常处理 | `src/core/utils/safeStorage.ts` |
| `numberBounds.ts` | 数值边界检查 | `src/core/utils/numberBounds.ts` |

#### 使用示例

```typescript
// ❌ 禁止：直接数组访问
const item = array[index];

// ✅ 推荐：使用安全工具库
import { safeArrayAccess } from '@/core/utils/safeArray';
const item = safeArrayAccess(array, index);

// ❌ 禁止：直接对象属性访问
const value = obj.deep.nested.property;

// ✅ 推荐：使用安全工具库
import { safeGet } from '@/core/utils/safeObject';
const value = safeGet(obj, 'deep.nested.property', defaultValue);

// ❌ 禁止：直接 JSON.parse
const data = JSON.parse(raw);

// ✅ 推荐：使用安全工具库
import { safeStorageGet } from '@/core/utils/safeStorage';
const result = safeStorageGet('key', defaultValue);
if (!result.success) {
  console.error(result.error);
  return defaultValue;
}

// ❌ 禁止：未检查数值边界
const damage = baseDamage * multiplier;

// ✅ 推荐：使用安全工具库
import { clampDamage, safeMultiply } from '@/core/utils/numberBounds';
const damage = clampDamage(safeMultiply(baseDamage, multiplier, DEFAULT_BOUNDS.DAMAGE));
```

### 1.2 高风险代码重构计划

#### 优先级定义

| 优先级 | 风险等级 | 重构时间表 |
|--------|----------|------------|
| P0 | 高危 | 立即处理 |
| P1 | 中危 | 1 周内处理 |
| P2 | 低危 | 1 月内处理 |

#### 目录优先级

1. `src/core/events` - 核心事件处理
2. `src/ui/views` - 用户界面
3. `src/core/actions` - 动作系统
4. `src/core/persistence` - 持久化层

#### 安全验证标准

- [ ] 所有数组访问使用 `safeArray.ts`
- [ ] 所有对象属性访问使用 `safeObject.ts`
- [ ] 所有存储操作使用 `safeStorage.ts`
- [ ] 所有数值计算使用 `numberBounds.ts`
- [ ] 通过 `npm run check:vulnerability-scan`
- [ ] 通过 `npm run lint`
- [ ] 通过 `npm run build`

---

## 2. 持续安全监控机制

### 2.1 定期漏洞扫描

#### 扫描命令

```bash
# 漏洞扫描
npm run check:vulnerability-scan

# 代码健康报告
npm run report:code-health

# 完整健康检查
npm run doctor:game:full
```

#### 扫描频率

| 扫描类型 | 频率 | 执行时间 |
|----------|------|----------|
| 漏洞扫描 | 每周 | 周一 09:00 |
| 代码健康报告 | 每周 | 周一 09:30 |
| 完整健康检查 | 每月 | 1日 09:00 |

### 2.2 风险趋势分析

#### 监控指标

| 指标 | 目标值 | 警戒值 |
|------|--------|--------|
| 严重问题 | 0 | > 0 |
| 高危问题 | 0 | > 0 |
| 中危问题 | < 100 | > 500 |
| 低危问题 | < 50 | > 100 |

#### 报告输出

- 漏洞扫描结果
- 中危处理进度
- 低危处理进度
- 本轮新增/减少数量
- 按目录分布

---

## 3. 代码审查安全控制

### 3.1 PR 安全检查流程

#### 检查项清单

- [ ] **新代码安全规范**
  - [ ] 数组访问使用 `safeArray.ts`
  - [ ] 对象属性访问使用 `safeObject.ts`
  - [ ] 存储操作使用 `safeStorage.ts`
  - [ ] 数值计算使用 `numberBounds.ts`

- [ ] **安全扫描通过**
  - [ ] `npm run check:vulnerability-scan` 通过
  - [ ] 无新增高危问题
  - [ ] 无新增未保护的 JSON.parse

- [ ] **代码质量检查**
  - [ ] `npm run lint` 通过
  - [ ] `npm run build` 通过
  - [ ] 相关测试通过

### 3.2 安全库使用规范

#### 禁止操作

| 禁止操作 | 替代方案 |
|----------|----------|
| `array[index]` | `safeArrayAccess(array, index)` |
| `obj.deep.property` | `safeGet(obj, 'deep.property', default)` |
| `JSON.parse(raw)` | `safeStorageGet(key, default)` |
| `localStorage.getItem(key)` | `safeStorageGet(key, default)` |
| `localStorage.setItem(key, value)` | `safeStorageSet(key, value)` |
| 未检查数值计算 | `clamp*(value)` 或 `safe*(value)` |

#### 审查要点

1. **数组访问**：检查是否使用安全工具库
2. **对象访问**：检查是否使用可选链或安全工具库
3. **存储操作**：检查是否有异常处理
4. **数值计算**：检查是否有边界检查

---

## 4. 应急响应流程

### 4.1 安全问题分级

| 等级 | 描述 | 响应时间 |
|------|------|----------|
| 严重 | 可能导致系统崩溃或数据丢失 | 立即处理 |
| 高危 | 可能导致功能异常或安全漏洞 | 24 小时内 |
| 中危 | 可能影响用户体验 | 1 周内 |
| 低危 | 代码质量问题 | 1 月内 |

### 4.2 处理流程

1. **发现问题**：通过扫描或审查发现安全问题
2. **评估等级**：根据影响范围评估问题等级
3. **制定方案**：确定修复方案和时间表
4. **实施修复**：使用安全工具库修复问题
5. **验证修复**：运行扫描和测试验证修复效果
6. **记录归档**：记录问题和修复过程

---

## 5. 附录

### 5.1 安全工具库 API 参考

#### safeArray.ts

```typescript
safeArrayAccess<T>(array: T[] | undefined | null, index: number): T | undefined
safeArrayAccessWithDefault<T>(array: T[] | undefined | null, index: number, defaultValue: T): T
safeArrayFirst<T>(array: T[] | undefined | null): T | undefined
safeArrayLast<T>(array: T[] | undefined | null): T | undefined
safeArraySlice<T>(array: T[] | undefined | null, start: number, end?: number): T[]
safeArrayFind<T>(array: T[] | undefined | null, predicate: (item: T) => boolean): T | undefined
safeArrayFilter<T>(array: T[] | undefined | null, predicate: (item: T) => boolean): T[]
safeArrayMap<T, U>(array: T[] | undefined | null, mapper: (item: T, index: number) => U): U[]
safeArrayReduce<T, U>(array: T[] | undefined | null, reducer: (acc: U, item: T, index: number) => U, initialValue: U): U
clampIndex(index: number, arrayLength: number): number
isValidArrayIndex(index: number, arrayLength: number): boolean
```

#### safeObject.ts

```typescript
safeGet<T>(obj: unknown, path: string, defaultValue: T): T
safeGetString(obj: unknown, path: string, defaultValue?: string): string
safeGetNumber(obj: unknown, path: string, defaultValue?: number): number
safeGetBoolean(obj: unknown, path: string, defaultValue?: boolean): boolean
safeGetArray<T>(obj: unknown, path: string, defaultValue?: T[]): T[]
safeGetObject<T>(obj: unknown, path: string, defaultValue?: T): T
safeInvoke<T, R>(obj: T | null | undefined, fn: (obj: T) => R, defaultValue: R): R
hasProperty(obj: unknown, prop: string): boolean
isNonNullObject(value: unknown): value is Record<string, unknown>
isEmptyObject(obj: unknown): boolean
```

#### safeStorage.ts

```typescript
isStorageAvailable(): boolean
safeStorageGet<T>(key: string, defaultValue: T): StorageResult<T>
safeStorageSet<T>(key: string, value: T): StorageResult<void>
safeStorageRemove(key: string): StorageResult<void>
safeStorageClear(): StorageResult<void>
getStorageSize(): number
getStorageQuota(): { used: number; available: number }
```

#### numberBounds.ts

```typescript
clamp(value: number, bounds: NumberBounds): number
clampHp(value: number): number
clampEnergy(value: number): number
clampBlock(value: number): number
clampDamage(value: number): number
clampStatusStacks(value: number): number
clampGold(value: number): number
safeNumber(value: unknown, defaultValue?: number): number
safePositiveNumber(value: unknown, defaultValue?: number): number
safeNonNegativeNumber(value: unknown, defaultValue?: number): number
safeInteger(value: unknown, defaultValue?: number): number
safeAdd(a: unknown, b: unknown, bounds: NumberBounds, defaultValue?: number): number
safeSubtract(a: unknown, b: unknown, bounds: NumberBounds, defaultValue?: number): number
safeMultiply(a: unknown, b: unknown, bounds: NumberBounds, defaultValue?: number): number
safeDivide(a: unknown, b: unknown, bounds: NumberBounds, defaultValue?: number): number
```

### 5.2 相关文档

- [漏洞扫描脚本](/scripts/validation/vulnerability_scan_ast.ts)
- [代码健康报告](/scripts/validation/code_health_report.ts)
- [安全工具库目录](/src/core/utils/)
