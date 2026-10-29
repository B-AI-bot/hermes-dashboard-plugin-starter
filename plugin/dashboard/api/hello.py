"""Backend of the example "hello" module.

Every api/<name>.py exports a FastAPI ``router``; plugin_api.py mounts it
under the plugin prefix, so these routes are served at
``/api/plugins/<plugin name>/hello``. Prefix routes with the module id to
avoid collisions between modules.
"""

import datetime
import os
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()


def _hermes_home():
    try:  # inside the dashboard process: follow Hermes' own resolution
        from hermes_constants import get_hermes_home

        return Path(get_hermes_home())
    except Exception:  # noqa: BLE001  (tests, or an older Hermes)
        return Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")


def _count_skills(home):
    skills = home / "skills"
    try:
        return sum(1 for _ in skills.rglob("SKILL.md"))
    except OSError:
        return 0


@router.get("/hello")
async def hello():
    # Plugin contract: never raise out of a handler, fold errors into the payload.
    home = _hermes_home()
    return {
        "ok": True,
        "message": "Hello from the starter plugin",
        "server_time": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "skills_installed": _count_skills(home),
    }


@router.post("/hello/echo")
async def echo(payload: dict):
    text = str((payload or {}).get("text", ""))[:500]
    return {"ok": True, "echo": text, "length": len(text)}
