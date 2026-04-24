"""
__init__.py - deckrogue_rules_core 包的公共入口

主要职责:
- 导出 RuleRuntime、boot 等核心 API
- 定义包的 __all__ 公开接口
"""

from .runtime import (
    RuleRuntime,
    boot,
    create_replay_log_v1,
    create_save_game_v2,
    replay_log,
    restore_snapshot_from_save_game,
)

__all__ = [
    "RuleRuntime",
    "boot",
    "create_replay_log_v1",
    "create_save_game_v2",
    "replay_log",
    "restore_snapshot_from_save_game",
]
