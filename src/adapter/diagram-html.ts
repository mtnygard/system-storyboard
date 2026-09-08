/** Only renderer-produced SVG is embedded as markup; authored text is escaped. */
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

function page(title: string, body: string, theme: "light" | "dark" = "light") {
  return `<!doctype html>
<html lang="en" data-theme="${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>
:root{color-scheme:${theme};font-family:system-ui,sans-serif;background:${theme === "dark" ? "#101820" : "#f5f7fa"};color:${theme === "dark" ? "#edf2f7" : "#182534"}}
body{margin:0;padding:clamp(16px,3vw,40px)}header,main{max-width:1600px;margin:auto}h1{font-size:1.6rem;margin:16px 0 8px}p{line-height:1.5}a{color:${theme === "dark" ? "#8dcaff" : "#075ca8"}}nav{display:flex;gap:24px;flex-wrap:wrap}.diagram{overflow:auto;margin-top:24px;border:1px solid #7f8b9955;border-radius:12px}.diagram svg{display:block;width:100%;height:auto;min-width:720px}li{margin:12px 0;line-height:1.5}.notes{padding:16px;border:1px solid #ac853f;border-radius:8px}small{font-weight:normal}
:root[data-theme=light]{color-scheme:light;background:#f5f7fa;color:#182534}:root[data-theme=dark]{color-scheme:dark;background:#101820;color:#edf2f7}:root[data-theme=light] a{color:#075ca8}:root[data-theme=dark] a{color:#8dcaff}
</style></head><body>${body}</body></html>`;
}

export type DiagramVariant = {
  state: string;
  view: string;
  theme: "light" | "dark";
  svg?: string;
  notes: string[];
  svgFilename?: string;
};

export function diagramHtml(options: {
  title: string;
  state: string;
  view: string;
  theme: "light" | "dark";
  svg: string;
  notes?: string[];
  svgFilename?: string;
  indexHref?: string;
  variants?: DiagramVariant[];
}) {
  const {
    title,
    state,
    view,
    theme,
    svg,
    notes = [],
    svgFilename,
    indexHref,
  } = options;
  if (options.variants) return diagramViewer(options, options.variants);
  return page(
    `${title} — ${view}`,
    `<header><nav>${indexHref ? `<a href="${escapeHtml(indexHref)}">All diagrams</a>` : ""}${svgFilename ? `<a href="${escapeHtml(svgFilename)}" download>Download SVG</a>` : ""}</nav><h1>${escapeHtml(title)}</h1><p>${escapeHtml(view)} · ${escapeHtml(state)} · ${theme} theme</p>${notes.length ? `<aside class="notes">${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</aside>` : ""}</header><main><div class="diagram">${svg}</div></main>`,
    theme,
  );
}

export type DiagramPageLink = {
  title: string;
  state: string;
  view: string;
  theme: string;
  path: string;
};
export function diagramIndex(entries: DiagramPageLink[], issues: string[]) {
  return page(
    "Exported diagrams",
    `<header><h1>Exported diagrams</h1><p>Open a diagram to view it, or download its separate SVG. These pages work offline.</p></header><main><ul>${entries.map((entry) => `<li><a href="${escapeHtml(entry.path)}.html">${escapeHtml(entry.title)} — ${escapeHtml(entry.view)}</a> <small>· ${escapeHtml(entry.state)} · ${escapeHtml(entry.theme)}</small> · <a href="${escapeHtml(entry.path)}.svg" download>SVG</a></li>`).join("")}</ul>${issues.length ? `<aside class="notes"><h2>Export notes</h2>${issues.map((issue) => `<p>${escapeHtml(issue)}</p>`).join("")}</aside>` : ""}</main>`,
  );
}

function diagramViewer(
  options: {
    title: string;
    state: string;
    view: string;
    theme: "light" | "dark";
    indexHref?: string;
  },
  variants: DiagramVariant[],
) {
  const states = [...new Set(variants.map((v) => v.state))];
  const initial = variants.findIndex(
    (v) =>
      v.state === options.state &&
      v.view === options.view &&
      v.theme === options.theme,
  );
  const selected = Math.max(0, initial);
  const controls = (
    label: string,
    values: string[],
    attribute: string,
    current: string,
  ) =>
    `<div role="group" aria-label="${label}">${values.map((value) => `<button type="button" data-${attribute}="${escapeHtml(value)}" aria-pressed="${value === current}">${escapeHtml(value[0].toUpperCase() + value.slice(1))}</button>`).join("")}</div>`;
  const content = (v: DiagramVariant) =>
    `${v.notes.length ? `<aside class="notes">${v.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</aside>` : ""}${v.svg ? `<div class="diagram">${v.svg}</div>` : "<p>This diagram is unavailable. See the export notes above.</p>"}${v.svgFilename && v.svg ? `<p><a href="${escapeHtml(v.svgFilename)}" download>Download SVG</a></p>` : ""}`;
  return page(
    options.title,
    `<style>.controls{display:flex;gap:20px;flex-wrap:wrap;margin:20px 0}.controls [role=group]{display:flex;gap:4px}button{font:inherit;color:inherit;background:transparent;border:1px solid #7f8b9977;border-radius:6px;padding:8px 12px;cursor:pointer}button[aria-pressed=true]{background:#167489;color:white}button:focus-visible{outline:3px solid #d69d25;outline-offset:2px}</style><header>${options.indexHref ? `<nav><a href="${escapeHtml(options.indexHref)}">All diagrams</a></nav>` : ""}<h1>${escapeHtml(options.title)}</h1><div class="controls">${controls("Diagram view", ["Architecture", "Sequence"], "view", variants[selected].view)}${controls("Presentation state", states, "state", variants[selected].state)}${controls("Appearance", ["light", "dark"], "theme", options.theme)}</div><p id="selection" aria-live="polite">${escapeHtml(variants[selected].view)} · ${escapeHtml(variants[selected].state)} · ${options.theme} theme</p><noscript>Enable JavaScript to switch views. The initial diagram remains available below.</noscript></header><main id="diagram-content">${content(variants[selected])}</main>${variants.map((v) => `<template data-view="${escapeHtml(v.view)}" data-state="${escapeHtml(v.state)}" data-theme="${v.theme}">${content(v)}</template>`).join("")}<script>
(() => {
 const buttons = [...document.querySelectorAll('button')];
 const content = document.getElementById('diagram-content');
 function show() {
  const view = document.querySelector('button[data-view][aria-pressed="true"]').dataset.view;
  const state = document.querySelector('button[data-state][aria-pressed="true"]').dataset.state;
  const theme = document.querySelector('button[data-theme][aria-pressed="true"]').dataset.theme;
  document.documentElement.dataset.theme = theme;
  const template = [...document.querySelectorAll('template')].find(t => t.dataset.view === view && t.dataset.state === state && t.dataset.theme === theme);
  content.replaceChildren(template.content.cloneNode(true));
  document.getElementById('selection').textContent = view + ' · ' + state + ' · ' + theme + ' theme';
 }
 buttons.forEach(button => button.addEventListener('click', () => {
  const key = button.hasAttribute('data-view') ? 'view' : button.hasAttribute('data-state') ? 'state' : 'theme';
  buttons.filter(b => b.hasAttribute('data-' + key)).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
  show();
 }));
})();
</script>`,
    options.theme,
  );
}
