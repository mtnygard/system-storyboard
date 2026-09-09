import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const PRESENTATION =
  "http://schemas.openxmlformats.org/presentationml/2006/main";
const DRAWING = "http://schemas.openxmlformats.org/drawingml/2006/main";

/** Complete PptxGenJS 4.0.1's embedded-video markup. That version writes the
 * media relationships and click action, but omits the slide-show timing tree
 * and derives movie shape IDs from relationship IDs (which can collide).
 *
 * This adapter accepts only newly generated Studio slides without timing.
 * Playback must target the movie's unique shape ID, not a relationship ID.
 * https://learn.microsoft.com/en-us/office/open-xml/presentation/how-to-add-a-video-to-a-slide-in-a-presentation
 */
export function addVideoPlayback(data: ArrayBuffer): ArrayBuffer {
  const files = unzipSync(new Uint8Array(data));
  for (const [name, bytes] of Object.entries(files)) {
    if (!/^ppt\/slides\/slide\d+\.xml$/.test(name)) continue;
    const doc = new DOMParser().parseFromString(
      strFromU8(bytes),
      "application/xml",
    );
    if (doc.querySelector("parsererror"))
      throw Error("Invalid PowerPoint slide XML.");
    const movies = [...doc.getElementsByTagNameNS(PRESENTATION, "pic")].filter(
      (picture) => picture.getElementsByTagNameNS(DRAWING, "videoFile").length,
    );
    if (!movies.length) continue;
    if (doc.getElementsByTagNameNS(PRESENTATION, "timing").length)
      throw Error(
        "The PowerPoint generator's video timing has changed. Review the playback adapter before exporting.",
      );
    let shapeId = Math.max(
      ...[...doc.getElementsByTagNameNS(PRESENTATION, "cNvPr")].map((element) =>
        Number(element.getAttribute("id")),
      ),
    );
    if (!Number.isFinite(shapeId)) throw Error("Invalid PowerPoint shape ID.");
    const element = (name: string, attributes: Record<string, string> = {}) => {
      const node = doc.createElementNS(PRESENTATION, `p:${name}`);
      for (const [name, value] of Object.entries(attributes))
        node.setAttribute(name, value);
      return node;
    };
    const timing = element("timing");
    const list = element("tnLst");
    const parallel = element("par");
    const root = element("cTn", {
      id: "1",
      dur: "indefinite",
      restart: "never",
      nodeType: "tmRoot",
    });
    const children = element("childTnLst");
    timing.append(list);
    list.append(parallel);
    parallel.append(root);
    root.append(children);
    for (const [index, movie] of movies.entries()) {
      const properties = movie.getElementsByTagNameNS(PRESENTATION, "cNvPr")[0];
      if (!properties)
        throw Error("The PowerPoint movie has no shape properties.");
      const id = String(++shapeId);
      properties.setAttribute("id", id);
      const video = element("video");
      const media = element("cMediaNode", { vol: "100000" });
      const clock = element("cTn", {
        id: String(index + 2),
        fill: "hold",
        display: "0",
      });
      const conditions = element("stCondLst");
      // Indefinite start waits for the movie's ppaction://media click action.
      conditions.append(element("cond", { delay: "indefinite" }));
      clock.append(conditions);
      const target = element("tgtEl");
      target.append(element("spTgt", { spid: id }));
      media.append(clock, target);
      video.append(media);
      children.append(video);
    }
    // CT_Slide requires timing after clrMapOvr/transition and before extLst.
    const extensions = [...doc.documentElement.children].find(
      (child) =>
        child.namespaceURI === PRESENTATION && child.localName === "extLst",
    );
    doc.documentElement.insertBefore(timing, extensions || null);
    files[name] = strToU8(new XMLSerializer().serializeToString(doc));
  }
  return new Uint8Array(zipSync(files)).buffer;
}
