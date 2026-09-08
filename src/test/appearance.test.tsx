import { it, expect, vi } from "vitest";
import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { APPEARANCE_KEY } from "../components/useAppearance";
import { seedWorkspace } from "../domain/seed";
import { compileScenario, renderPreview } from "../adapter/compiler";
function expectedStyle(theme: "dark" | "light") {
  const w = seedWorkspace();
  const r = compileScenario(w.scenarios[0], w.participants, "transition");
  if (!r.ok) throw Error("Invalid fixture");
  return new DOMParser()
    .parseFromString(
      renderPreview(r.graph, "architecture", theme)!.svg,
      "image/svg+xml",
    )
    .querySelector("style")!.textContent;
}
it("persists appearance and rethemes live and held previews without changing scenario data", async () => {
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole("button", { name: /^Appearance:/ }));
  await user.click(screen.getByRole("button", { name: "Dark mode" }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(APPEARANCE_KEY)).toBe("dark");
  await user.click(screen.getByRole("button", { name: /Order to SAP/ }));
  const preview = screen.getByRole("region", { name: "Live diagram preview" });
  expect(preview.querySelector("svg style")!.textContent).toBe(
    expectedStyle("dark"),
  );
  await user.clear(screen.getByRole("textbox", { name: "Action for step 1" }));
  expect(
    within(preview).getByText(/Showing the last valid/),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /^Appearance:/ }));
  await user.click(screen.getByRole("button", { name: "Light mode" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  expect(preview.querySelector("svg style")!.textContent).toBe(
    expectedStyle("light"),
  );
  view.unmount();
  render(<App />);
  expect(
    screen.getByRole("button", { name: "Appearance: Light" }),
  ).toBeInTheDocument();
});
it("follows system changes only when System is selected", async () => {
  const original = window.matchMedia;
  let dark = false;
  const listeners = new Set<() => void>();
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    get matches() {
      return query === "(prefers-color-scheme: dark)" && dark;
    },
    addEventListener: (_: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
  }));
  try {
    const user = userEvent.setup();
    const view = render(<App />);
    expect(
      screen.getByRole("button", { name: "Appearance: System" }),
    ).toBeInTheDocument();
    act(() => {
      dark = true;
      listeners.forEach((fn) => fn());
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(screen.getByRole("button", { name: /^Appearance:/ }));
    await user.click(screen.getByRole("button", { name: "Light mode" }));
    act(() => {
      dark = false;
      listeners.forEach((fn) => fn());
      dark = true;
      listeners.forEach((fn) => fn());
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /^Appearance:/ }));
    await user.click(
      screen.getByRole("button", { name: "Follow system appearance" }),
    );
    expect(document.documentElement.dataset.theme).toBe("dark");
    view.unmount();
    expect(listeners.size).toBe(0);
  } finally {
    window.matchMedia = original;
  }
});
