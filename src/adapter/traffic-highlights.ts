import type { GraphDoc } from "@coldtea/pr-lens-schema";
import type { RenderedSvg } from "@coldtea/pr-lens-renderer";

/** Use the pulse's own opacity keyframes so exported SVGs and playback controls
 * share exactly the same clock. Atlas coordinates include the canvas shift;
 * the paths and pulse groups live inside that shift. */
export function highlightTraffic(
  graph: GraphDoc,
  rendered: RenderedSvg,
): RenderedSvg {
  const interactions =
    rendered.lens === "architecture"
      ? Object.keys(rendered.atlas.edges).map(
          (id) => graph.edges.find((edge) => edge.id === id)!,
        )
      : graph.flows.flatMap((flow) => flow.messages);
  const shift = rendered.svg.match(
    /<g transform="translate\(([-\d.]+),([-\d.]+)\)"/,
  );
  const dx = Number(shift?.[1] ?? 0);
  const dy = Number(shift?.[2] ?? 0);
  let index = 0;
  const svg = rendered.svg.replace(
    /(<path\b(?=[^>]*\bclass="(?:edge|msg)\s)[^>]*\/>)(\s*(?:<circle\b[^>]*>[\s\S]*?<\/circle>\s*)*)/g,
    (_match, path: string, pulses: string) => {
      const interaction = interactions[index++];
      if (!pulses.trim() || !interaction) return path + pulses;
      const asynchronous =
        interaction.kind === "async" || interaction.kind === "event";
      const colour = asynchronous
        ? rendered.theme === "dark"
          ? "#c4b5fd"
          : "#7c3aed"
        : rendered.theme === "dark"
          ? "#ffd166"
          : "#b66a00";
      const boxes = [...new Set([interaction.from, interaction.to])]
        .map((id) => {
          const box = rendered.atlas.nodes[id];
          return `<rect x="${box.x - dx - 3}" y="${box.y - dy - 3}" width="${box.width + 6}" height="${box.height + 6}" rx="12"/>`;
        })
        .join("");
      const route = path
        .replace(/class="[^"]*"/, 'class="traffic-route"')
        .replace(/\/>$/, ` stroke="${colour}" stroke-width="4"/>`);
      return (
        path +
        pulses.replace(/<circle\b[^>]*>[\s\S]*?<\/circle>/g, (pulse) => {
          const opacity = pulse.match(
            /<animate\b[^>]*attributeName="opacity"[^>]*\/>/,
          )?.[0];
          if (!opacity) throw Error("Traffic highlight timing is unavailable");
          const dot = pulse.replace(/<circle\b[^>]*>/, (circle) =>
            circle
              .replace(
                /\br="([^"]*)"/,
                (_attribute, radius: string) => `r="${Number(radius) * 2}"`,
              )
              .replace(/\bfill="[^"]*"/, `fill="${colour}"`),
          );
          return `<g data-studio-traffic="true"><g data-studio-highlight="true" opacity="0" fill="none" stroke="${colour}" stroke-width="3" pointer-events="none">${route}${boxes}${opacity}</g>${dot}</g>`;
        })
      );
    },
  );
  return { ...rendered, svg };
}
