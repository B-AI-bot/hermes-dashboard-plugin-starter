// Example module. Copy this file to start a new one, then add a line to
// sp/manifest.json. Backend routes for it live in ../../api/hello.py.

export const id = "hello";

export function render(ctx) {
  return (
    '<div class="hello-card">' +
    "<h2>Hello</h2>" +
    '<dl class="hello-facts">' +
    "<dt>Hermes version</dt><dd data-hello=\"version\">…</dd>" +
    "<dt>Skills installed</dt><dd data-hello=\"skills\">…</dd>" +
    "<dt>Server time</dt><dd data-hello=\"time\">…</dd>" +
    "</dl>" +
    '<form class="hello-echo">' +
    '<input name="text" placeholder="Type something" autocomplete="off">' +
    '<button type="submit">Echo via plugin API</button>' +
    "</form>" +
    '<p class="hello-out" aria-live="polite"></p>' +
    "</div>"
  );
}

export function init(ctx, el) {
  const set = (k, v) => {
    const node = el.querySelector('[data-hello="' + k + '"]');
    if (node) node.textContent = v;
  };

  // A built-in Hermes endpoint, through the SDK client.
  ctx.SDK.api.getStatus()
    .then((s) => set("version", s.version || "unknown"))
    .catch(() => set("version", "unavailable"));

  // This plugin's own backend (api/hello.py).
  ctx.api("/hello")
    .then((r) => {
      set("skills", String(r.skills_installed));
      set("time", r.server_time);
    })
    .catch(() => { set("skills", "unavailable"); set("time", "unavailable"); });

  const form = el.querySelector(".hello-echo");
  const out = el.querySelector(".hello-out");
  const onSubmit = (e) => {
    e.preventDefault();
    const text = form.elements.text.value;
    ctx.api("/hello/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then((r) => { out.textContent = "Server says: " + r.echo + " (" + r.length + " chars)"; })
      .catch((err) => { out.textContent = "Request failed: " + (err && err.message); });
  };
  form.addEventListener("submit", onSubmit);
  return () => form.removeEventListener("submit", onSubmit);
}
