import type { Interaction, Scenario, State } from "./model";
export type OverrideKey = keyof NonNullable<Interaction["targetOverrides"]>;
export function effectiveInteraction(
  i: Interaction,
  state: State,
): Interaction {
  return state === "target" && i.current && i.target
    ? { ...i, ...i.targetOverrides }
    : i;
}
export function editInteraction(
  i: Interaction,
  patch: Partial<Interaction>,
  state: State,
): Interaction {
  if (patch.current === false && i.current && i.target)
    return {
      ...effectiveInteraction(i, "target"),
      ...patch,
      targetOverrides: undefined,
    };
  if (state !== "target" || !i.current || !i.target) return { ...i, ...patch };
  const { id, current, target, changed, targetOverrides, ...fields } = patch;
  return {
    ...i,
    ...(current === undefined ? {} : { current }),
    ...(target === undefined ? {} : { target }),
    ...(changed === undefined ? {} : { changed }),
    targetOverrides: { ...i.targetOverrides, ...fields },
  };
}
export function resetOverride(i: Interaction, key: OverrideKey): Interaction {
  const overrides = { ...i.targetOverrides };
  delete overrides[key];
  return {
    ...i,
    targetOverrides: Object.keys(overrides).length ? overrides : undefined,
  };
}
/** Transition shows both endpoints of a change; single-state projections keep row identity. */
export function projectInteractions(s: Scenario, state: State): Scenario {
  const interactions = s.interactions.flatMap((i) => {
    const target = effectiveInteraction(i, "target");
    const differs = Object.keys(i.targetOverrides || {}).some(
      (key) => i[key as OverrideKey] !== target[key as OverrideKey],
    );
    if (state !== "transition")
      return [
        {
          ...effectiveInteraction(i, state),
          changed: i.changed || (state === "target" && differs),
        },
      ];
    return i.current && i.target && differs
      ? [
          { ...i, target: false },
          { ...target, id: `${i.id}-target`, current: false },
        ]
      : [i];
  });
  return {
    ...s,
    interactions,
    walkthroughSteps:
      state === "transition"
        ? s.walkthroughSteps.map((step) => ({
            ...step,
            interactionIds: step.interactionIds.flatMap((id) =>
              interactions.some((i) => i.id === `${id}-target`)
                ? [id, `${id}-target`]
                : [id],
            ),
          }))
        : s.walkthroughSteps,
  };
}
