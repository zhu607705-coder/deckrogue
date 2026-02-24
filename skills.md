# 📄 Roguelike 卡牌构建与环境威胁数学建模框架 (极致详尽版)

**适用对象**：主策划、数值策划、核心战斗程序员、AI行为设计师
**建模目标**：建立一套从“底层卡牌公式”到“高层游戏进程控制”的绝对量化体系。将卡牌、遗物、药水、敌人意图、地图经济完全统合在同一套代数/概率论架构下，杜绝“主观调参”，实现系统级的生态平衡。

---

## 模块 I: 基础状态空间与资源本体论 (State Space & Ontology)

系统的基石在于定义绝对的边界与收益上限，防止单一属性（如无限护甲、无限加费）导致的数学模型崩溃。

### 1.1 玩家防线双轨模型 (Dual-Track Defense Mitigation)
为了区分“爆发防御”与“持久防御”，防线模型被拆分为两轨：

1.  **格挡 (Block, $B$)**：即时响应。
    *   **特性**：回合末清零，无减伤衰减。
    *   **适用流派**：循环流、高周转流。
2.  **护甲 (Armor, $A$)**：跨回合累计的全局减伤。
    *   **特性**：跨回合继承，受非线性函数 $DR(A)$ 衰减限制。
    *   **减伤方程**：$$DR(A) = \frac{A}{A + \kappa}$$
        *   $\kappa$ 为**半衰常数**。建议在当前 Act 设定下，$\kappa \approx 1.5 \times \overline{EID}$ (平均期望受击伤害)。例如第一章 $\kappa=30$，第二章 $\kappa=60$。
    *   **最终承伤公式**：
        $$D_{taken} = \max\left(0, D_{in} - B\right) \times \left(1 - DR(A)\right)$$

### 1.2 状态算子基准 (Status Modifiers)
定义状态异常的标准化乘区，避免系统内出现多个不同比例的“加伤/减伤”导致换算维度混乱：
*   **易伤 (Vulnerable, $Vul$)**: 受到伤害乘以 $\mu_{vul} = 1.50$。
*   **虚弱 (Weak, $Wea$)**: 造成伤害乘以 $\mu_{wea} = 0.75$。
*   **脆弱 (Frail, $Fra$)**: 获得格挡乘以 $\mu_{fra} = 0.75$。
*   **力量 (Strength, $Str$) / 敏捷 (Dexterity, $Dex$)**: 绝对值加成。
    *   *多段攻击极度受益于力量，需在卡牌价值中用攻击段数 $N$ 进行补偿计算。*

---

## 模块 II: 跨维度卡牌绝对价值评估模型 (Absolute Card Valuation)

此模块定义单卡的基础价值 ($V_{base}$)。它是评定稀有度、控制卡池强度膨胀的唯一标尺。

### 2.1 伤害的时间价值 (Time Value of Damage, TVD)
毒素（Poison）、流血（Bleed）等延迟伤害 (DOT) 必须折现，否则模型会高估其价值。
引入**折现率 $\gamma$ (Discount Factor)**，建议取 $\gamma \in [0.75, 0.85]$。

**等效伤害价值 ($EDV$)** 的计算公式：
$$EDV = k_{dmg} \times \left( D_{burst} + \sum_{t=1}^{T} D_{dot}(t) \times \gamma^t \right)$$
> *举例：假设 $k_{dmg}=1, \gamma=0.8$。*
> *卡牌 A：立即造成 10 点伤害 $\rightarrow EDV = 10$。*
> *卡牌 B：给予目标 3 层毒（每回合减 1，持续 3 回合），即 3+2+1 点伤害 $\rightarrow EDV = 3 \times 0.8^1 + 2 \times 0.8^2 + 1 \times 0.8^3 = 2.4 + 1.28 + 0.512 = 4.192$。*
> *结论：要让卡牌 B 的价值等同于 A，B 必须给予更多的层数。*

### 2.2 多段与群体攻击的价值补正
*   **多段攻击补正**：设攻击段数为 $n$。每多一段，该卡牌享受力量 ($Str$) 的收益就翻倍。引入力量潜力因子 $\phi_{str} \approx 1.5$。
    $$EDV_{multi} = k_{dmg} \times (D_{base} \times n) + (n-1) \times \phi_{str}$$
*   **群体攻击 (AOE) 补正**：基于当前 Act 的平均怪物数量 $\overline{E_{count}}$（通常介于 1.8 到 2.5）。
    $$EDV_{aoe} = k_{dmg} \times D_{base} \times \min(\overline{E_{count}}, Max\_Targets) \times 0.85$$ *(打折是因为存在单怪场景)*

### 2.3 状态附加与效用的等效换算
*   **施加易伤/虚弱**：折算为当前窗口期预期输出/受击伤害的百分比。
    *   $EDV_{vul} = \text{预期 2 回合玩家输出} \times 0.50 \times k_{dmg}$
    *   $EBV_{weak} = \text{预期 2 回合敌人输出} \times 0.25 \times k_{blk}$
*   **过牌 (Draw) 与 能量 (Energy)**：
    *   基础抽 1 张牌：$k_{draw} = 4$ 价值点。
    *   产生 1 点能量：$k_{eng} = 10$ 价值点。

### 2.4 $V_{base}$ 大一统方程式与稀有度标定
任意卡牌 $i$ 的绝对价值方程式：
$$V_{base}(i) = \left( EDV_i + EBV_i + EUV_i \right) - \left( C_i \times k_{eng} \right) + V_{opportunity}$$
*   $C_i$: 消耗的能量。
*   $V_{opportunity}$: 占用抓位的机会成本补偿（设为常数，如 10）。

**稀有度严格卡控（禁止数值溢出）：**
*   **Common (普通 / 基础基石)**: $V_{base} \in [8, 15]$
*   **Uncommon (罕见 / 核心机制)**: $V_{base} \in [14, 23]$
*   **Rare (稀有 / 破局手段)**: $V_{base} \in [22, 35]$

---

## 模块 III: 牌组协同强度度量与一致性计算 (Deck Power & Consistency)

单卡价值并不决定最终胜率。我们需要评估玩家手中 20-30 张卡牌组成的系统在 $W$ 回合（窗口期）内的期望表现。

### 3.1 期望输出 (EDPT) 与 有效生命 (EHP)
*   **EDPT (Expected Damage Per Turn)**：玩家在 $W$ 回合内，通过蒙特卡洛抽牌模拟计算出的平均每回合最高可能输出。
*   **EHP (Effective Hit Points)**：考虑护甲减伤、回血、格挡后的预期存活容量。
    $$EHP(W) = \left( HP_{current} + \sum_{t=1}^W E[Block_t] \right) \times \frac{1}{1 - \overline{DR(A)}}$$

### 3.2 抽卡一致性的超几何分布 (Hypergeometric Consistency, $P_{hit}$)
用超几何分布量化“卡手”概率。
设牌库总量 $N$，Key 牌数量 $K$（如核心输出牌或关键防御牌），起手抓牌 $H$。
第一回合抽到**至少一张** Key 牌的概率：
$$P_{hit} = 1 - \frac{\binom{N-K}{H}}{\binom{N}{H}}$$
*   **卡组臃肿惩罚**：如果 $P_{hit} < 0.6$，说明卡组一致性极差，极易被爆发怪初见杀。
*   **检索/保留卡的机制价值**：它们通过人为提高 $H$ 或减小 $N$ 来极大拉升 $P_{hit}$，这在 $DP$ 计算中具有极高权重。

### 3.3 牌组综合战力标量 (Deck Power, DP)
将上述三者融合为一个可比较的宏观数值，用于关卡生成器的难度匹配：
$$DP = \omega_1 \cdot EDPT(W) + \omega_2 \cdot \frac{EHP(W)}{W} + \omega_3 \cdot f(P_{hit}) + \sum \Delta V_{relics}$$
*其中 $f(P_{hit})$ 为非线性奖励函数，确保高一致性卡组获得更高评分。*

---

## 模块 IV: 威胁预算与敌人逆向生成 (Threat Budget Reverse Engineering)

这是本框架的核心：**敌人的属性不是填表填出来的，而是根据玩家当前阶段的 $DP$ 预期推导出来的。**

### 4.1 压迫时钟与目标参数
为当前节点设定两个致命时钟：
*   **$TTK_{target}$ (Target Time to Kill)**：期望玩家在几个回合内解决战斗？（普通=3~4，精英=5~7，Boss=9~12）。
*   **$T_{fail}$ (Time to Fail)**：如果玩家只输出不防御，几个回合会被打死？（普通=4~5，精英=5~6，Boss=7~9）。

### 4.2 敌人数值逆向推导公式
已知当前 Act 玩家的平均输出期望 $EDPT_{ref}$ 和血量池 $HP_{ref}$。

1.  **怪物总血量池 ($HP_{total}$)**:
    $$HP_{total} = EDPT_{ref} \times TTK_{target} \times \sigma_{var}$$
    *$\sigma_{var} \in [0.9, 1.1]$ 为防止雷同的波动率。*
2.  **怪物每回合期望输出 ($EID$, Expected Incoming Damage)**:
    $$EID = \frac{HP_{ref} \times \lambda_{attrition}}{T_{fail}}$$
    *$\lambda_{attrition}$ 为设计容忍战损率（如普通怪只消耗玩家 15% 状态，$\lambda = 0.15$）。*
3.  **初见杀熔断器 (Peak Damage Limit)**:
    单回合内，敌方可能造成的最高伤害 $D_{peak}$ 必须满足：
    $$D_{peak} \le 0.55 \times HP_{ref}$$
    *如果超过此阈值，AI 树中必须加入强制的“蓄力（Telegraph）”或“发呆”动作进行预警。*

---

## 模块 V: AI 意图：带状态约束的 Softmax 模型 (Constrained Softmax Intent)

摒弃死板的“攻击-防御-Buff”三连招循环。引入运筹学中的 Softmax 行为评分，使 AI 具有“可预测的模糊智能”。

### 5.1 动作评分函数 (Action Scoring Function)
对于敌人的动作库 $A = \{a_1, a_2, ..., a_n\}$，动作 $a_i$ 的基础得分为：
$$S(a_i, t) = Base_i + \alpha \Delta HP\% + \beta I(State_{player}) + M_{cooldown}$$
*   $Base_i$: 动作偏好度。
*   $\alpha \Delta HP\%$ : 濒死狂暴机制（血量越低，高伤动作权重越高）。
*   $\beta I(State_{player})$: 协同机制（如果玩家有易伤，增加重击的权重）。
*   $M_{cooldown}$: 冷却与复读惩罚。如果上一回合用过，本回合 $M_{cooldown} = -1000$（绝不复读）。

### 5.2 温度参数归一化 (Temperature Softmax)
计算每个动作的实际释放概率：
$$P(a_i) = \frac{\exp(S(a_i) / \tau)}{\sum_j \exp(S(a_j) / \tau)}$$
*   **$\tau$ (温度参数) 的妙用**：
    *   $\tau \to \infty$：完全随机（适用于疯狂的低级地精/史莱姆）。
    *   $\tau \to 0$：绝对理性最优解（适用于高阶施法者/关底 Boss，永远寻找玩家弱点）。
    *   通过调整 $\tau$，玩家能直观感受到怪物“智商”的区别。

---

## 模块 VI: 进度经济学与通胀曲线 (Progression & Economic Inflation)

随着游戏推进（Act 1 -> 2 -> 3），数值必须发生幂律膨胀，以刺激玩家持续优化牌组。

### 6.1 复利膨胀模型 (Power Curve)
设当前层数为 $L$，基准膨胀率为 $r$（如 $r = 0.15$，每层膨胀 15%）：
$$DP_{target}(L) = DP_0 \times (1 + r)^L$$

**所有生态要素必须与 $r$ 强绑定同步膨胀**：
1.  敌人的 $HP_{total}$ 和 $EID$ 乘以 $(1+r)^L$。
2.  商店物品的购买金币价格乘以 $(1+r)^L$。
3.  卡牌升级（Upgrade）带来的 $V_{base}$ 增益，必须足够对抗这部分的膨胀。

---

## 模块 VII: 奇物与药水拓展子系统 (Relics & Potions)

它们不占用卡组循环，是“打破常规数学模型”的外部变量，必须纳入严格换算。

### 7.1 奇物 (Relics) 价值映射
将奇物的独特效果折算为稳定的 $\Delta DP$ 增量：
1.  **数值加成型 (Stat-Boosts)**: 如“获得 10 最大 HP”。
    $\Delta DP = \omega_2 \times (\frac{10}{W})$
2.  **计数器触发型 (Triggered)**: 如“每打 3 张攻击牌，造成 5 点伤害”。
    计算每回合触发概率 $P_{trig}$。$\Delta DP = \omega_1 \times P_{trig} \times 5$。
3.  **核心质变型 (Boss Relics)**: 如“每回合能量 +1，但无法休息”。
    直接将模块 II 中的可用能量上限 $E$ 加 1，并扣除预期的回复 $EHP$。

### 7.2 药水 (Potions): 极限方差抹平器 (Variance Smoother)
药水的本质是：**一回合的超级超模卡**。
*   **定位**：用于应对超几何分布（模块 3.1）极度非酋导致的“鬼抽”回合，或扛下模块 4.2 中的 $D_{peak}$。
*   **价值标定**：普通药水的单次等效价值 $V_{potion}$ 应等于一张 Rare 级卡牌的两倍（约等于 3 费的瞬间爆发或绝对防御）。

---

## 模块 VIII: 数值与生态检视表 (Mathematical Self-Audit Checklist)

开发期间，必须用此清单（配合后台脚本或蒙特卡洛仿真）对数据进行刚性校验：

1.  **初见杀熔断器测试**：
    *   [ ] 遍历所有敌人的 Softmax 意图，确认绝对不存在第 1 回合造成 $>0.55 \times HP_{max}$ 的情况。
2.  **毒系平权测试 (DOT Equity)**：
    *   [ ] 在设定 $\gamma=0.8$ 后，一张 1 费 3 层毒卡牌的最终 $EDV$ 是否与一张 1 费 6 点直接伤害卡的 $EDV$ 差值在 $\pm 10\%$ 以内？
3.  **卡牌陷阱测试 (Noob Trap Detection)**：
    *   [ ] 检索高费（3费以上）且不带立即生效效果的卡牌，其 $V_{base}$ 计算结果是否被严重低估？如果是，是否需要添加“获得时自带保留”或增加防御词条？
4.  **防线击穿测试 (Armor Integrity)**：
    *   [ ] 使用全护甲流派脚本跑 1000 次模拟，查看是否会在特定精英怪面前由于 $\kappa$ 设定过低导致免伤过高（>90%）而死不了？（必须加入破甲或穿透怪作为生态制衡）。
5.  **卡组一致性红线**：
    *   [ ] 一个 30 张牌且无过牌机制的牌组，其第一回合 $P_{hit}$ 将低于极度危险值。商店中是否必定提供了足够比例的“删牌服务”或带有“检索”标签的 Common 牌？

---
*编者按：此文档提供的是逻辑骨架。在游戏引擎中，请将公式 I ~ V 封装为独立的数据结构类，以支持百万级别的蒙特卡洛随机对战模拟，从而获得精确的常数系数值。*
