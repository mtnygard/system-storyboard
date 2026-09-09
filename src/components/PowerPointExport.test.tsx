import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PowerPointExport } from "./PowerPointExport";
import { seedWorkspace } from "../domain/seed";

const mock = vi.hoisted(() => ({
  exportPresentation: vi.fn(),
  download: vi.fn(),
}));
vi.mock("../adapter/presentation-export", () => ({
  exportPresentation: mock.exportPresentation,
}));
vi.mock("../domain/storage", () => ({ download: mock.download }));
beforeEach(() => {
  vi.clearAllMocks();
});
function show() {
  const workspace = seedWorkspace();
  return render(
    <PowerPointExport
      scenario={workspace.scenarios[0]}
      catalog={workspace.participants}
      state="transition"
      theme="dark"
    />,
  );
}
it("downloads a single PPTX after both slide and video generation succeed", async () => {
  const data = new ArrayBuffer(4);
  mock.exportPresentation.mockResolvedValue({ data, slideCount: 12 });
  show();
  fireEvent.click(screen.getByRole("button", { name: /Download PowerPoint/ }));
  await waitFor(() =>
    expect(mock.download).toHaveBeenCalledWith(
      "Order-to-SAP-transition-dark.pptx",
      data,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ),
  );
  expect(screen.getByRole("status")).toHaveTextContent("12 slides");
});
it("does not download a partial deck on failure", async () => {
  mock.exportPresentation.mockRejectedValue(Error("Complete the walkthrough."));
  show();
  fireEvent.click(screen.getByRole("button", { name: /Download PowerPoint/ }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Complete the walkthrough.",
  );
  expect(mock.download).not.toHaveBeenCalled();
});
it("cancels the active export and allows another attempt", async () => {
  mock.exportPresentation.mockImplementation(
    (_s, _c, _state, _theme, _progress, signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );
  show();
  fireEvent.click(screen.getByRole("button", { name: /Download PowerPoint/ }));
  await waitFor(() => expect(mock.exportPresentation).toHaveBeenCalledTimes(1));
  fireEvent.click(
    screen.getByRole("button", { name: "Cancel PowerPoint export" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent("cancelled"),
  );
  expect(mock.download).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: /Download PowerPoint/ }),
  ).toBeEnabled();
});
it("aborts encoding when the export dialog closes", async () => {
  let signal: AbortSignal;
  mock.exportPresentation.mockImplementation(
    (_s, _c, _state, _theme, _progress, received: AbortSignal) => {
      signal = received;
      return new Promise((_resolve, reject) =>
        received.addEventListener("abort", () => reject(received.reason)),
      );
    },
  );
  const view = show();
  fireEvent.click(screen.getByRole("button", { name: /Download PowerPoint/ }));
  await waitFor(() => expect(mock.exportPresentation).toHaveBeenCalledTimes(1));
  view.unmount();
  expect(signal!.aborted).toBe(true);
  expect(mock.download).not.toHaveBeenCalled();
});
