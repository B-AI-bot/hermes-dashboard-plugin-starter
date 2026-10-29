"""Backend for the starter dashboard plugin.

Hermes mounts the module-level ``router`` under ``/api/plugins/<name>/``
(``<name>`` = ``manifest.json`` "name"). This file stays small on purpose:
it serves one core route and mounts every ``api/<module>.py`` it finds, so a
new module never has to edit it.
"""

import importlib.util
import logging
from pathlib import Path

from fastapi import APIRouter

log = logging.getLogger(__name__)

router = APIRouter()

API_DIR = Path(__file__).parent / "api"

# Filled by mount_module_apis(): module file stem -> "ok" | "error: ..."
MODULE_APIS = {}


@router.get("/health")
async def health():
    return {"ok": True, "module_apis": MODULE_APIS}


def mount_module_apis(target=router, api_dir=API_DIR):
    """Import each api/<name>.py by file path and include its ``router``.

    Loaded by path, not as a package, because Hermes imports plugin_api.py
    outside any package context. A module that fails to import is logged and
    skipped: one broken module never takes the other routes down.
    """
    if not api_dir.is_dir():
        return MODULE_APIS
    for f in sorted(api_dir.glob("*.py")):
        if f.name.startswith("_"):
            continue
        try:
            spec = importlib.util.spec_from_file_location(f"dashboard_module_{f.stem}", f)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            sub = getattr(mod, "router", None)
            if sub is None:
                MODULE_APIS[f.stem] = "error: no router"
                continue
            target.include_router(sub)
            MODULE_APIS[f.stem] = "ok"
        except Exception as e:  # noqa: BLE001
            MODULE_APIS[f.stem] = f"error: {type(e).__name__}"
            log.warning("module api %s failed to load: %s", f.name, e)
    return MODULE_APIS


mount_module_apis()
