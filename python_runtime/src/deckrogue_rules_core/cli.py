"""
cli.py - 规则引擎的命令行接口，通过 stdin/stdout JSON 协议与宿主进程通信

主要职责:
- 从 stdin 逐行读取 JSON 请求并分派到 RuleRuntime
- 将执行结果以 JSON 格式写入 stdout
"""

from __future__ import annotations

import json
import sys
from typing import Any

from .runtime import RuleRuntime, boot


def _write(message: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(message, ensure_ascii=True) + "\n")
    sys.stdout.flush()


def _response(request: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    if "request_id" in request:
        return {"request_id": request["request_id"], **payload}
    return payload


def main() -> int:
    runtime: RuleRuntime | None = None

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request: dict[str, Any] = {}
        try:
            request = json.loads(line)
            op = request.get("op")

            if op == "init":
                runtime = boot(request["content_bundle"], seed=int(request.get("seed", 0)))
                _write(_response(request, {"ok": True, "snapshot": runtime.snapshot()}))
                continue

            if op == "snapshot":
                if runtime is None:
                    raise RuntimeError("Runtime has not been initialized")
                _write(_response(request, {"ok": True, "snapshot": runtime.snapshot()}))
                continue

            if op == "dispatch":
                if runtime is None:
                    raise RuntimeError("Runtime has not been initialized")
                _write(_response(request, {"ok": True, **runtime.dispatch(request["command"])}))
                continue

            if op == "shutdown":
                _write(_response(request, {"ok": True}))
                return 0

            raise RuntimeError(f"Unsupported op: {op}")
        except Exception as exc:  # pragma: no cover - exercised through TS integration
            request_id = request.get("request_id") if isinstance(request, dict) else None
            payload = {"ok": False, "error": str(exc)}
            if request_id is not None:
                payload = {"request_id": request_id, **payload}
            _write(payload)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
