import type { Interaction } from "../domain/model";
import { missingDetails } from "../domain/drafts";
/** Explicit completion actions move focus after React mounts the inspector.
 * Ordinary row selection must not steal focus from inline table editing. */
export function focusInteractionDetail(interaction: Interaction) {
  const field = missingDetails(interaction)[0] || "action";
  setTimeout(() => {
    const input = document.querySelector<HTMLElement>(
      `[data-interaction-detail="${field}"] input, [data-interaction-detail="${field}"] select`,
    );
    input?.scrollIntoView?.({ block: "center", inline: "nearest" });
    input?.focus();
  }, 0);
}
