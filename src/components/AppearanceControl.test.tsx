import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearanceControl } from "./AppearanceControl";
it("shows only the current icon until hovered and supports keyboard dismissal", async () => {
  const user = userEvent.setup();
  const choose = vi.fn();
  render(<AppearanceControl value="system" onChange={choose} />);
  const trigger = screen.getByRole("button", { name: "Appearance: System" });
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await user.hover(trigger);
  expect(screen.getByRole("button", { name: "Light mode" })).toBeVisible();
  await user.unhover(trigger);
  expect(
    screen.queryByRole("button", { name: "Light mode" }),
  ).not.toBeInTheDocument();
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("button", { name: "Light mode" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await user.keyboard("{Enter}");
  await user.tab();
  await user.keyboard("{Enter}");
  expect(choose).toHaveBeenCalledWith("light");
  expect(trigger).toHaveAttribute("aria-expanded", "false");
});
