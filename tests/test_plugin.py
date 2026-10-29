"""Minimal checks: manifests are consistent, the backend loader mounts module
routes and survives a broken module, and the JS parses."""

import importlib.util
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

DASH = Path(__file__).resolve().parent.parent / "plugin" / "dashboard"


def load_plugin_api(dash_dir):
    spec = importlib.util.spec_from_file_location("plugin_api_under_test", dash_dir / "plugin_api.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def client_for(dash_dir):
    mod = load_plugin_api(dash_dir)
    app = FastAPI()
    app.include_router(mod.router, prefix="/api/plugins/starter")
    return TestClient(app)


def test_manifests_consistent():
    man = json.loads((DASH / "manifest.json").read_text())
    for key in ("name", "label", "entry"):
        assert man.get(key), key
    assert man["tab"]["path"].startswith("/")
    for key in ("entry", "css", "api"):
        assert (DASH / man[key]).is_file(), man[key]
    registry = json.loads((DASH / "dist" / "sp" / "manifest.json").read_text())
    ids = [m["id"] for m in registry["modules"]]
    assert len(ids) == len(set(ids))
    for m in registry["modules"]:
        assert (DASH / "dist" / "sp" / m["module"]).is_file(), m["module"]
        if m.get("css"):
            assert (DASH / "dist" / "sp" / m["css"]).is_file(), m["css"]


def test_core_and_module_routes():
    c = client_for(DASH)
    assert c.get("/api/plugins/starter/health").json() == {"ok": True, "module_apis": {"hello": "ok"}}
    hello = c.get("/api/plugins/starter/hello").json()
    assert hello["ok"] is True and isinstance(hello["skills_installed"], int)
    echo = c.post("/api/plugins/starter/hello/echo", json={"text": "ping"}).json()
    assert echo == {"ok": True, "echo": "ping", "length": 4}


def test_broken_module_is_skipped(tmp_path):
    dash = tmp_path / "dashboard"
    shutil.copytree(DASH, dash, ignore=shutil.ignore_patterns("__pycache__"))
    (dash / "api" / "broken.py").write_text("raise RuntimeError('boom')\n")
    c = client_for(dash)
    health = c.get("/api/plugins/starter/health").json()
    assert health["module_apis"]["broken"].startswith("error")
    assert health["module_apis"]["hello"] == "ok"
    assert c.get("/api/plugins/starter/hello").status_code == 200


@pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")
def test_js_parses():
    for f in sorted((DASH / "dist").rglob("*.js")) + sorted((DASH / "dist").rglob("*.mjs")):
        subprocess.run(["node", "--check", str(f)], check=True)
