// Core shell of the starter dashboard plugin (plain IIFE, no build step).
//
// It reads dist/sp/manifest.json, dynamic-imports each module listed there
// (one ES module per feature), and renders a small tab bar with one screen
// per module. Adding a feature never edits this file: drop a .mjs in sp/,
// add one line to sp/manifest.json, optionally an api/<id>.py backend.
//
// Module contract (ES module exports):
//   render(ctx)      -> HTML string for the module's screen   (required)
//   init(ctx, el)    -> wire events once the screen is in the DOM; may
//                       return a cleanup function             (optional)
// ctx = { SDK, api, esc, plugin }
//   api(path, init)  -> SDK.fetchJSON on /api/plugins/<plugin><path>
//                       (session auth handled by the dashboard)
//
// A module that fails to import, render or init is logged and skipped.
(function () {
  "use strict";

  var SDK = window.__HERMES_PLUGIN_SDK__;
  if (!SDK || !window.__HERMES_PLUGINS__) return;
  var React = SDK.React;

  // Derive plugin name and asset base from this script's own URL
  // (/dashboard-plugins/<name>/dist/index.js), so renaming the plugin only
  // means changing manifest.json "name" and the directory name.
  var SRC = (document.currentScript && document.currentScript.src) || "";
  var m = SRC.match(/\/dashboard-plugins\/([^/]+)\/dist\/index\.js/);
  var PLUGIN = m ? decodeURIComponent(m[1]) : "starter";
  var SP_BASE = SRC ? SRC.replace(/index\.js(\?.*)?$/, "sp/") : "/dashboard-plugins/" + PLUGIN + "/dist/sp/";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function api(path, init) {
    return SDK.fetchJSON("/api/plugins/" + PLUGIN + path, init);
  }

  function loadCss(href) {
    if (document.querySelector('link[data-starter-css="' + href + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    l.setAttribute("data-starter-css", href);
    document.head.appendChild(l);
  }

  // Import every module in the registry; keep registry order, drop failures.
  function loadModules() {
    return fetch(SP_BASE + "manifest.json")
      .then(function (r) { return r.json(); })
      .then(function (man) {
        var list = (man && man.modules) || [];
        return Promise.all(list.map(function (entry) {
          if (!entry || !entry.id || !entry.module) return null;
          return import(SP_BASE + entry.module).then(function (mod) {
            if (entry.css) loadCss(SP_BASE + entry.css);
            return { id: entry.id, label: entry.label || entry.id, mod: mod };
          }).catch(function (err) {
            console.warn("[" + PLUGIN + "] module " + entry.id + " failed to load:", err);
            return null;
          });
        }));
      })
      .then(function (mods) { return mods.filter(Boolean); });
  }

  function mount(root, modules) {
    var ctx = { SDK: SDK, api: api, esc: esc, plugin: PLUGIN };
    var cleanups = [];
    var tabs = modules.map(function (x, i) {
      return '<button type="button" class="starter-tab" data-tab="' + esc(x.id) + '"' +
        (i === 0 ? ' aria-selected="true"' : ' aria-selected="false"') + ">" + esc(x.label) + "</button>";
    }).join("");
    root.innerHTML =
      '<div class="starter-shell">' +
      '<nav class="starter-tabs" role="tablist">' + tabs + "</nav>" +
      '<div class="starter-screens"></div>' +
      "</div>";
    var screens = root.querySelector(".starter-screens");

    if (!modules.length) {
      screens.innerHTML = '<p class="starter-empty">No module loaded. Check dist/sp/manifest.json and the browser console.</p>';
    }

    modules.forEach(function (x, i) {
      var el = document.createElement("section");
      el.className = "starter-screen";
      el.setAttribute("data-screen", x.id);
      el.hidden = i !== 0;
      screens.appendChild(el);
      try {
        el.innerHTML = x.mod.render ? x.mod.render(ctx) : "";
        if (x.mod.init) {
          var c = x.mod.init(ctx, el);
          if (typeof c === "function") cleanups.push(c);
        }
      } catch (err) {
        console.warn("[" + PLUGIN + "] module " + x.id + " failed to render:", err);
        el.innerHTML = '<p class="starter-empty">This module failed to render.</p>';
      }
    });

    root.querySelector(".starter-tabs").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tab]");
      if (!btn) return;
      var id = btn.getAttribute("data-tab");
      root.querySelectorAll("[data-tab]").forEach(function (b) {
        b.setAttribute("aria-selected", String(b === btn));
      });
      root.querySelectorAll("[data-screen]").forEach(function (s) {
        s.hidden = s.getAttribute("data-screen") !== id;
      });
    });

    return function () {
      cleanups.forEach(function (c) { try { c(); } catch (e) { /* noop */ } });
    };
  }

  function StarterPage() {
    var ref = SDK.hooks.useRef(null);
    SDK.hooks.useEffect(function () {
      var dead = false;
      var unmount = null;
      var el = ref.current;
      loadModules().then(function (modules) {
        if (!dead && el) unmount = mount(el, modules);
      }).catch(function (err) {
        if (el) el.innerHTML = '<p class="starter-empty">Failed to load modules (' + esc(err && err.message) + ").</p>";
      });
      return function () {
        dead = true;
        if (unmount) unmount();
        if (el) el.innerHTML = "";
      };
    }, []);
    return React.createElement("div", { ref: ref, className: "starter-root" });
  }

  window.__HERMES_PLUGINS__.register(PLUGIN, StarterPage);
})();
