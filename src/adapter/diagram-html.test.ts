import { expect, it } from "vitest";
import { diagramHtml, diagramIndex } from "./diagram-html";

it("embeds the SVG in a complete offline document and escapes authored text", () => {
  const title = '<script>alert("test")</script> & orders';
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text>Order</text></svg>';
  const html = diagramHtml({
    title,
    state: "target",
    view: "Architecture",
    theme: "dark",
    svg,
    notes: [title],
  });
  const doc = new DOMParser().parseFromString(html, "text/html");
  expect(doc.title).toBe(`${title} — Architecture`);
  expect(doc.querySelector("h1")?.textContent).toBe(title);
  expect(doc.querySelector("aside")?.textContent).toContain(title);
  expect(doc.querySelector("svg text")?.textContent).toBe("Order");
  expect(doc.querySelectorAll("script, iframe, link, img, a")).toHaveLength(0);
  expect(html).toContain("color-scheme:dark");
});

it("escapes index titles and export issues", () => {
  const title = '<img src=x onerror="alert(1)">';
  const doc = new DOMParser().parseFromString(
    diagramIndex(
      [
        {
          title,
          state: "current",
          view: "Sequence",
          theme: "light",
          path: "01-scenario/current/sequence-light",
        },
      ],
      [title],
    ),
    "text/html",
  );
  expect(doc.querySelectorAll("img, script")).toHaveLength(0);
  expect(doc.querySelector("li")?.textContent).toContain(title);
  expect(doc.querySelector("aside")?.textContent).toContain(title);
});

it("switches embedded projections and views offline without duplicate live SVG IDs", () => {
  const variants = (["light", "dark"] as const).flatMap((theme) =>
    ["current", "target", "transition"].flatMap((state) =>
      ["Architecture", "Sequence"].map((view) => ({
        state,
        view,
        theme,
        svg: `<svg id="diagram"><text>${theme} ${state} ${view}</text></svg>`,
        notes: state === "target" ? ["Unfinished step 3"] : [],
        svgFilename: `${state}-${view}-${theme}.svg`,
      })),
    ),
  );
  const html = diagramHtml({
    title: "Story",
    state: "transition",
    view: "Architecture",
    theme: "light",
    svg: variants[0].svg,
    variants,
  });
  const doc = new DOMParser().parseFromString(html, "text/html");
  document.body.innerHTML = doc.body.innerHTML;
  new Function(doc.querySelector("script")!.textContent!)();
  for (const theme of ["dark", "light"]) {
    (
      document.querySelector(
        `button[data-theme="${theme}"]`,
      ) as HTMLButtonElement
    ).click();
    expect(document.documentElement.dataset.theme).toBe(theme);
    for (const state of ["current", "target", "transition"]) {
      (
        document.querySelector(
          `button[data-state="${state}"]`,
        ) as HTMLButtonElement
      ).click();
      for (const view of ["Architecture", "Sequence"]) {
        (
          document.querySelector(
            `button[data-view="${view}"]`,
          ) as HTMLButtonElement
        ).click();
        expect(document.querySelector("main svg text")?.textContent).toBe(
          `${theme} ${state} ${view}`,
        );
        expect(document.querySelectorAll("svg#diagram")).toHaveLength(1);
        expect(document.querySelector("main a")?.getAttribute("href")).toBe(
          `${state}-${view}-${theme}.svg`,
        );
        expect(document.querySelector("main aside")?.textContent ?? "").toBe(
          state === "target" ? "Unfinished step 3" : "",
        );
      }
    }
  }
  delete document.documentElement.dataset.theme;
  document.body.innerHTML = "";
});
