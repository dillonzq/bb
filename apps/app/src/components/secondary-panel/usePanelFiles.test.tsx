import { renderHookStatically } from "@/test/render-hook-statically";
import { describe, expect, it, vi } from "vitest";
import type { ExperimentalLiveFileTarget } from "@get-bb/plugin-sdk";
import { usePanelFiles, type PanelFileScope } from "./usePanelFiles";
import type { OpenSecondaryPanelTabRequest } from "./useThreadFileTabs";

interface SurfaceCase {
  name: string;
  scope: PanelFileScope | null;
  accepts: Record<
    | "ownWorkspace"
    | "ownHost"
    | "hostOutsideWorkspace"
    | "ownStorage"
    | "otherWorkspace",
    boolean
  >;
}

const OWN_WORKSPACE: ExperimentalLiveFileTarget = {
  kind: "workspace",
  environmentId: "env_1",
  path: "src/a.ts",
};
const OTHER_WORKSPACE: ExperimentalLiveFileTarget = {
  kind: "workspace",
  environmentId: "env_other",
  path: "src/a.ts",
};
const WORKSPACE_ROOT = { hostId: "host_1", path: "/work/repo" };
const OWN_HOST: ExperimentalLiveFileTarget = {
  kind: "host",
  hostId: "host_1",
  path: "/work/repo/src/log.txt",
};
const HOST_OUTSIDE_WORKSPACE: ExperimentalLiveFileTarget = {
  kind: "host",
  hostId: "host_1",
  path: "/work/other/log.txt",
};
const OWN_STORAGE: ExperimentalLiveFileTarget = {
  kind: "thread-storage",
  threadId: "thr_1",
  path: "notes.md",
};

const SURFACES: readonly SurfaceCase[] = [
  {
    name: "thread view",
    scope: {
      threadId: "thr_1",
      environmentId: "env_1",
      hostId: "host_1",
      workspaceRoot: null,
    },
    accepts: {
      ownWorkspace: true,
      ownHost: true,
      hostOutsideWorkspace: true,
      ownStorage: true,
      otherWorkspace: false,
    },
  },
  {
    name: "New thread screen reusing an environment",
    scope: {
      threadId: null,
      environmentId: "env_1",
      hostId: "host_1",
      workspaceRoot: WORKSPACE_ROOT,
    },
    accepts: {
      ownWorkspace: true,
      ownHost: true,
      hostOutsideWorkspace: false,
      ownStorage: false,
      otherWorkspace: false,
    },
  },
  {
    name: "New thread screen on the project folder",
    scope: {
      threadId: null,
      environmentId: null,
      hostId: null,
      workspaceRoot: WORKSPACE_ROOT,
    },
    accepts: {
      ownWorkspace: false,
      ownHost: true,
      hostOutsideWorkspace: false,
      ownStorage: false,
      otherWorkspace: false,
    },
  },
  {
    name: "New thread screen without a workspace folder",
    scope: {
      threadId: null,
      environmentId: "env_1",
      hostId: "host_1",
      workspaceRoot: null,
    },
    accepts: {
      ownWorkspace: true,
      ownHost: false,
      hostOutsideWorkspace: false,
      ownStorage: false,
      otherWorkspace: false,
    },
  },
  {
    name: "plugin page",
    scope: null,
    accepts: {
      ownWorkspace: true,
      ownHost: true,
      hostOutsideWorkspace: true,
      ownStorage: true,
      otherWorkspace: true,
    },
  },
];

function renderSurface(surface: SurfaceCase, available = true) {
  const openTab = vi.fn((_request: OpenSecondaryPanelTabRequest) => ({
    id: "tab",
  }));
  const reveal = vi.fn();
  const panelFiles = renderHookStatically(() =>
    usePanelFiles({ available, openTab, reveal, scope: surface.scope }),
  );
  return { openTab, panelFiles, reveal };
}

describe.each(SURFACES)("panel files on the $name", (surface) => {
  it.each([
    ["ownWorkspace", OWN_WORKSPACE],
    ["ownHost", OWN_HOST],
    ["hostOutsideWorkspace", HOST_OUTSIDE_WORKSPACE],
    ["ownStorage", OWN_STORAGE],
    ["otherWorkspace", OTHER_WORKSPACE],
  ] as const)("applies the surface rule to a %s target", (caseName, target) => {
    const { openTab, panelFiles, reveal } = renderSurface(surface);
    const accepted = panelFiles.openFilePreview({ target, location: null });

    expect(accepted).toBe(surface.accepts[caseName]);
    expect(openTab).toHaveBeenCalledTimes(accepted ? 1 : 0);
    expect(reveal).toHaveBeenCalledTimes(accepted ? 1 : 0);
  });

  it("opens host files in the same tab shape core uses", () => {
    if (!surface.accepts.ownHost) return;
    const { openTab, panelFiles } = renderSurface(surface);
    panelFiles.openFilePreview({ target: OWN_HOST, location: null });
    if (surface.scope?.threadId === null) {
      panelFiles.openWorkspaceFile({
        lineRange: null,
        path: "src/log.txt",
        source: { kind: "working-tree" },
        statusLabel: null,
      });
    } else {
      panelFiles.openHostFile({ lineRange: null, path: OWN_HOST.path });
    }

    const [apiRequest, coreRequest] = openTab.mock.calls.map(
      ([request]) => request,
    );
    expect(apiRequest).toEqual(
      surface.scope === null
        ? { ...coreRequest, hostId: OWN_HOST.hostId }
        : coreRequest,
    );
  });

  it.each([
    ["HEAD", { kind: "head" }],
    ["abc1234", { kind: "merge-base", ref: "abc1234" }],
  ] as const)("opens the %s revision as a read-only preview", (ref, source) => {
    if (!surface.accepts.ownWorkspace) return;
    const { openTab, panelFiles } = renderSurface(surface);
    panelFiles.openFilePreview({
      target: { ...OWN_WORKSPACE, experimental_ref: ref },
      location: null,
    });

    expect(openTab).toHaveBeenCalledWith(
      {
        kind: "workspace-file-preview",
        environmentId: "env_1",
        tab: { lineRange: null, path: "src/a.ts", source, statusLabel: null },
      },
      undefined,
    );
  });

  it("declines malformed targets and unavailable surfaces", () => {
    const { panelFiles: available } = renderSurface(surface);
    const { panelFiles: unavailable, openTab } = renderSurface(surface, false);

    expect(
      available.openFilePreview({
        target: { ...OWN_WORKSPACE, path: "../escape" },
        location: null,
      }),
    ).toBe(false);
    expect(
      unavailable.openFilePreview({
        target: OWN_WORKSPACE,
        location: null,
      }),
    ).toBe(false);
    expect(openTab).not.toHaveBeenCalled();
  });
});

describe("host files on the New thread screen", () => {
  const surface = SURFACES[2]!;

  it("opens them relative to the workspace folder with their location", () => {
    const { openTab, panelFiles } = renderSurface(surface);
    panelFiles.openFilePreview({
      target: OWN_HOST,
      location: { kind: "range", startLine: 3, endLine: 5 },
    });

    expect(openTab).toHaveBeenCalledWith(
      {
        kind: "workspace-file-preview",
        tab: {
          lineRange: { startLineNumber: 3, endLineNumber: 5 },
          path: "src/log.txt",
          source: { kind: "working-tree" },
          statusLabel: null,
        },
      },
      undefined,
    );
  });

  it.each([
    ["the workspace folder itself", { ...OWN_HOST, path: WORKSPACE_ROOT.path }],
    [
      "a sibling folder sharing its prefix",
      { ...OWN_HOST, path: "/work/repository/a.ts" },
    ],
    ["another host", { ...OWN_HOST, hostId: "host_2" }],
  ] as const)("declines %s", (_name, target) => {
    const { openTab, panelFiles } = renderSurface(surface);

    expect(panelFiles.openFilePreview({ target, location: null })).toBe(false);
    expect(openTab).not.toHaveBeenCalled();
  });
});
