# DeckRogue 逐项追踪查看报告 - 2026-05-08

## 范围

- 基线提交: c2d51ca / c2d51ca07616a76a1a3f1e0f382b75bb00a4ce94
- 提交标题: Close validated DeckRogue expansion plans
- 追踪目标: 最新提交中的所有文件变更，以及本次继续发现的原创化/命名清理变更。
- 边界: 不提交 .claude/，不提交 output/generated_images/ 源图归档；运行资产保留在 public/assets/。

## 风险扫描

- 真实密钥扫描: 未发现 sk-* 或 API key 实值；secret 命中均为普通玩法/变量词。
- 旧 IP 关键词扫描: 活跃源码、内容数据和运行文档已清理直接第三方 IP 关键词；本报告仅保留历史删除路径作为审计证据。
- 大体积资源: public/assets/music/ 已作为运行资源纳入；远端若限制仓库体积，后续需要 LFS 或资源分发方案。

## 最新提交逐文件追踪

| 状态 | 文件 | 分类 | 追踪结论 |
| --- | --- | --- | --- |
| M | .env.example | 配置/壳层 | 已纳入逐项检查范围 |
| M | .gitignore | 配置/壳层 | 已纳入逐项检查范围 |
| A | docs/design/original-gothic-expansion-review.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/design/skills.md | 文档/报告 | 原创化表达与计划/指南记录 |
| A | docs/design/sts-inspired-original-expansion.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/ART_GENERATION_GUIDE.md | 文档/报告 | 原创化表达与计划/指南记录 |
| A | docs/guides/ORIGINAL_GOTHIC_IMPLEMENTATION_GUIDE.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/README.md | 文档/报告 | 原创化表达与计划/指南记录 |
| D | docs/guides/WARHAMMER_IMPLEMENTATION_GUIDE.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/map_background_setup.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | electron/main.mjs | 配置/壳层 | 已纳入逐项检查范围 |
| M | electron/preload.cjs | 配置/壳层 | 已纳入逐项检查范围 |
| M | package.json | 配置/壳层 | 已纳入逐项检查范围 |
| M | project-development-report.md | 文档/报告 | 已纳入逐项检查范围 |
| M | public/assets/backgrounds/bg_chaos_warp.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_eldar_void.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_gothic_battlefield.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_imperium_palace.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_mechanicus_forge.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_necron_tomb.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_nurgle_garden.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/backgrounds/bg_sisters_chapel.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/enemies/barrier_redeemer.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/enemies/cultist_herald.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/enemies/goblin_trapper.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/enemies/jaw_worm_burrower.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/enemies/slime_small_glass.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/enemies/slime_small_rot.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/events/event_chaos_gate.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/events/event_forge.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/events/event_heretic_altar.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/events/event_shrine.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/events/event_trial.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| M | public/assets/events/event_warp.png | 图片/公开资源 | 原创命名资源；引用已同步 |
| A | public/assets/music/README.md | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_alchemist.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_brute.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_chronomancer.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_informant.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_judge.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_puppeteer.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_tactician.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/character/char_void.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_bloodmill.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_confession.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_corruption.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_crypt.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_flesh.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_flies.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_grave.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_inquisitor.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_larval.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_logic.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_martyr.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_medicae.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_operatory.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_oracle.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_orphanage.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_overclock.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_passage.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_plague.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_psalm.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_reactor.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_sanctum.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_septic.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_servo.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_spore.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_terminal.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_vault.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_warp.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_warp_gate.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/event/event_wedding.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/char_select.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/combat_boss.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/combat_elite.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/combat_normal.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/event.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/game_over.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/map_explore.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/rest.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/reward.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/shop.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| A | public/assets/music/scene/victory.mp3 | 音乐运行资源 | 纳入运行加载资产；由 musicManifest/audio tests 覆盖 |
| M | public/assets/shop/shop_black.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/shop/shop_forge.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/shop/shop_merchant.png | 图片/公开资源 | 已纳入逐项检查范围 |
| M | public/assets/shop/shop_trade.png | 图片/公开资源 | 已纳入逐项检查范围 |
| A | public/assets/tuanjie/manifest.json | 图片/公开资源 | 已纳入逐项检查范围 |
| M | python_runtime/src/deckrogue_rules_core/cli.py | 核心运行时 | 已纳入逐项检查范围 |
| M | scripts/validation/check_content_authoring.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_enemy_ai_profiles.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_growth_route_formation.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_rest_route_reinforcement.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_reward_tradeoff_quality.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_route_taxonomy_guardrails.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_shop_event_growth_nodes.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/check_shop_route_reinforcement.ts | 验证/工具脚本 | 验收入口或质量门 |
| A | scripts/validation/check_tuanjie_asset_manifest.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/contentReachabilityCheck.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/dogfood_victory_flow.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/flow_smoke_helpers.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/playwright_electron_smoke.ts | 验证/工具脚本 | 验收入口或质量门 |
| A | scripts/validation/playwright_map_responsive_smoke.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/playwright_real_ui_30_clicks.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/playwright_ui_smoke.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/playwright_ui_smoke_expansion.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/playwright_victory_flow.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | scripts/validation/review_ci.ts | 验证/工具脚本 | 验收入口或质量门 |
| A | src/content/assets/tuanjieModelManifest.ts | 内容数据 | 已纳入逐项检查范围 |
| M | src/content/data/cards.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/enemies.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| A | src/content/data/musicManifest.ts | 音频系统 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/narrative/numericSystem.ts | 内容数据 | 已纳入逐项检查范围 |
| M | src/content/narrative/routeSignals.ts | 内容数据 | 已纳入逐项检查范围 |
| A | src/core/events/MusicDispatcher.ts | 音频系统 | 音乐播放与调度实现 |
| D | src/core/events/SaveManager.ts | 核心运行时 | 删除或更名，需由替代路径覆盖 |
| M | src/core/events/gameEngine.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/index.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/performance/MemoryManager.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/persistence/saveManager.ts | 核心运行时 | 存档安全与形状校验 |
| M | src/core/persistence/setup.ts | 核心运行时 | 存档安全与形状校验 |
| M | src/core/utils/safeStorage.ts | 核心运行时 | 已纳入逐项检查范围 |
| A | src/features/audio/.gitkeep | 音频系统 | 音乐播放与调度实现 |
| A | src/features/audio/AudioManager.ts | 音频系统 | 音乐播放与调度实现 |
| A | src/features/audio/MusicEngine.ts | 音频系统 | 音乐播放与调度实现 |
| M | src/runtimeV2/bridge/pythonWasmAdapter.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/runtimeV2/contracts.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/runtimeV2/node/pythonProcessAdapter.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/runtimeV2/pythonInterop.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/ui/animations/AnimationSpeedManager.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/components/LoadingScreen.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/components/VoxLogPanel.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/launcher/SetupLauncher.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/motion/motionSystem.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/ThemeContext.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/grimdark.css | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/grimdark.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/index.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/AppShell.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/CharacterSelectView.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/EventView.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/MapView.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/combat/CombatHUD.tsx | 前端界面 | 已纳入逐项检查范围 |
| A | tests/unit/audioManager.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/enemyAiProfileCoverage.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/eventManagerContract.test.ts | 测试 | 对应行为回归覆盖 |
| A | tests/unit/musicManifest.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/numericsDomain.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/runtimeV2Parity.test.ts | 测试 | 对应行为回归覆盖 |
| A | tests/unit/saveManagerSecurity.test.ts | 测试 | 对应行为回归覆盖 |
| A | tests/unit/tuanjieModelManifest.test.ts | 测试 | 对应行为回归覆盖 |
| M | vite.config.ts | 配置/壳层 | 已纳入逐项检查范围 |

## 本次追踪后续清理逐文件追踪

| 状态 | 文件 | 分类 | 追踪结论 |
| --- | --- | --- | --- |
| M | create_lore_doc.cjs | 其他 | 已纳入逐项检查范围 |
| M | docs/design/skills.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/development-reports/project-development-report.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/ART_GENERATION_GUIDE.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/ORIGINAL_GOTHIC_IMPLEMENTATION_GUIDE.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/guides/map_background_setup.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | docs/superpowers/plans/2026-04-01-ai-enhanced-system.md | 文档/报告 | 原创化表达与计划/指南记录 |
| M | index.html | 配置/壳层 | 已纳入逐项检查范围 |
| M | metadata.json | 配置/壳层 | 已纳入逐项检查范围 |
| M | progress.md | 文档/报告 | 已纳入逐项检查范围 |
| D | public/assets/backgrounds/bg_chaos_warp.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_eldar_void.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_imperium_palace.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_mechanicus_forge.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_necron_tomb.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_nurgle_garden.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/backgrounds/bg_sisters_chapel.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| D | public/assets/events/event_chaos_gate.png | 图片/公开资源 | 旧 IP 风格资源名替换为原创命名；引用已更新 |
| M | scripts/analysis/generate_missing_artwork.ts | 验证/工具脚本 | 已纳入逐项检查范围 |
| M | scripts/analysis/rebalance_from_skills.cjs | 验证/工具脚本 | 已纳入逐项检查范围 |
| M | scripts/assets/generate_art.cjs | 验证/工具脚本 | 已纳入逐项检查范围 |
| M | scripts/test-ai-features.ts | 验证/工具脚本 | 已纳入逐项检查范围 |
| M | scripts/validation/flow_smoke_helpers.ts | 验证/工具脚本 | 验收入口或质量门 |
| M | src/content/data/achievements.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/battleBackgrounds.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/branchingOutcomes.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/cardNames.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/cards.json | 内容数据 | 用户可见卡牌/遗物名与内部 ID 原创化，内容校验通过 |
| M | src/content/data/characters.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/doctrines.json | 内容数据 | 内容合同/authoring/bundle 覆盖 |
| M | src/content/data/relics.json | 内容数据 | 用户可见卡牌/遗物名与内部 ID 原创化，内容校验通过 |
| M | src/content/narrative/numericSystem.ts | 内容数据 | 已纳入逐项检查范围 |
| M | src/content/narrative/storyEvents.ts | 内容数据 | 已纳入逐项检查范围 |
| M | src/core/actions/v2/ActionFactory.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/actions/v2/SpecialActions.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/actions/v2/WarpActions.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/events/metricsTracker.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/relic/RelicPurify.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/relic/RelicResonance.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/types/actions.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/core/types/combat.ts | 核心运行时 | 已纳入逐项检查范围 |
| M | src/features/relics/relicSystem.ts | 其他 | 已纳入逐项检查范围 |
| M | src/features/synergies/synergySystem.ts | 其他 | 已纳入逐项检查范围 |
| M | src/index.css | 前端界面 | 已纳入逐项检查范围 |
| M | src/types/combat.ts | 其他 | 已纳入逐项检查范围 |
| M | src/ui/components/BackgroundImage.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/components/ResourcePreloader.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/components/ViewBackgroundLayer.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/hooks/useCombatTelemetry.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/launcher/SetupLauncher.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/grimdark.css | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/theme/grimdark.ts | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/AppShell.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/CombatView.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/MapView.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/combat/Battlefield.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | src/ui/views/combat/EnemyStandee.tsx | 前端界面 | 已纳入逐项检查范围 |
| M | tests/unit/actionManagerAndRoomFlow.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/eventManagerContract.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/growthRoutePhase2.test.ts | 测试 | 对应行为回归覆盖 |
| M | tests/unit/roomSessionLifecycle.test.ts | 测试 | 对应行为回归覆盖 |

## 已运行验证

- git diff --check: exit 0
- npm run lint --silent: exit 0
- npx tsc --noEmit --pretty false --project tsconfig.json: exit 0
- npm run check:content-contract-layer: OK
- npm run check:content-authoring: Cards 330/330, Enemies 50/50, Relics 98/98
- npm run check:content-bundle: 7/7 passed
- npm run check:tuanjie-assets: passed
- npx tsx --test tests/unit/eventManagerContract.test.ts tests/unit/actionManagerAndRoomFlow.test.ts tests/unit/growthRoutePhase2.test.ts tests/unit/roomSessionLifecycle.test.ts: 25/25 passed
- npx tsx --test tests/unit/musicManifest.test.ts tests/unit/tuanjieModelManifest.test.ts tests/unit/audioManager.test.ts: 8/8 passed
- npm run build: exit 0
- npm run doctor:game: 44/44 passed
- npm run check:release-readiness: 41/41 passed after doctor refreshed generated artifacts
