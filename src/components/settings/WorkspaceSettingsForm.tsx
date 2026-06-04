import { createSignal, For } from "solid-js";
import {
  workspaceSettings,
  setWorkspaceSettings,
  saveWorkspaceSettings,
} from "../../stores/settings";
import { SettingRow } from "./SettingRow";

export function WorkspaceSettingsForm() {
  const [newExt, setNewExt] = createSignal("");
  const [newCmd, setNewCmd] = createSignal("");

  const handleExcludeItems = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    const items = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    setWorkspaceSettings("excludeItems", items);
    saveWorkspaceSettings();
  };

  const handleRunCommand = (e: Event) => {
    setWorkspaceSettings(
      "runCommand",
      (e.currentTarget as HTMLInputElement).value,
    );
    saveWorkspaceSettings();
  };

  const updateRunMapVal = (ext: string, cmd: string) => {
    setWorkspaceSettings("runMap", (prev) => ({ ...prev, [ext]: cmd }));
    saveWorkspaceSettings();
  };

  const removeRunMapVal = (ext: string) => {
    setWorkspaceSettings("runMap", (prev) => {
      const copy = { ...prev };
      delete copy[ext];
      return copy;
    });
    saveWorkspaceSettings();
  };

  const addRunMapVal = () => {
    const ext = newExt().trim();
    const cmd = newCmd().trim();
    if (!ext || !cmd) return;
    const formattedExt = ext.startsWith(".") ? ext : `.${ext}`;
    setWorkspaceSettings("runMap", (prev) => ({
      ...prev,
      [formattedExt]: cmd,
    }));
    saveWorkspaceSettings();
    setNewExt("");
    setNewCmd("");
  };

  return (
    <div class="flex flex-col pb-12">
      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-2 text-[var(--color-accent)]">
          File Explorer
        </h2>

        <SettingRow
          label="Exclude Items"
          description="Comma-separated list of files and folders to hide from the file tree."
        >
          <input
            type="text"
            value={workspaceSettings.excludeItems.join(", ")}
            onChange={handleExcludeItems}
            placeholder=".git, node_modules"
            class="w-full px-3 py-1.5 rounded-md outline-none border text-sm"
            style={{
              background: "var(--color-bg-secondary)",
              color: "var(--color-fg)",
              "border-color": "var(--color-border)",
            }}
          />
        </SettingRow>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-2 text-[var(--color-accent)]">
          Build & Run
        </h2>

        <SettingRow
          label="Run Command"
          description="The command executed when clicking the Play button."
        >
          <input
            type="text"
            value={workspaceSettings.runCommand}
            onChange={handleRunCommand}
            placeholder="npm run dev"
            class="w-full px-3 py-1.5 rounded-md outline-none border font-mono text-sm"
            style={{
              background: "var(--color-bg-secondary)",
              color: "var(--color-fg)",
              "border-color": "var(--color-border)",
            }}
          />
        </SettingRow>
      </section>

      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-4 text-[var(--color-accent)]">
          File Run Mappings
        </h2>
        <div class="flex flex-col gap-3 p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div class="grid grid-cols-12 gap-2 font-medium text-xs text-[var(--color-fg-muted)] pb-2 border-b border-[var(--color-border)]">
            <div class="col-span-3">Extension</div>
            <div class="col-span-8">Run Command</div>
            <div class="col-span-1 text-right font-semibold">Action</div>
          </div>

          <For each={Object.entries(workspaceSettings.runMap || {})}>
            {([ext, cmd]) => (
              <div class="grid grid-cols-12 gap-2 items-center text-sm py-1">
                <div class="col-span-3 font-mono">{ext}</div>
                <input
                  type="text"
                  value={cmd}
                  onChange={(e) => updateRunMapVal(ext, e.currentTarget.value)}
                  class="col-span-8 px-2 py-1 rounded border text-xs font-mono"
                  style={{
                    background: "var(--color-bg)",
                    color: "var(--color-fg)",
                    "border-color": "var(--color-border)",
                  }}
                />
                <button
                  onClick={() => removeRunMapVal(ext)}
                  class="col-span-1 text-xs text-red-500 hover:text-red-700 cursor-pointer text-center bg-transparent border-0 font-semibold"
                >
                  Remove
                </button>
              </div>
            )}
          </For>

          {/* Add Row */}
          <div class="grid grid-cols-12 gap-2 items-center pt-3 border-t border-[var(--color-border)]">
            <input
              type="text"
              placeholder=".py"
              value={newExt()}
              onInput={(e) => setNewExt(e.currentTarget.value)}
              class="col-span-3 px-2 py-1 rounded border text-xs font-mono"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-fg)",
                "border-color": "var(--color-border)",
              }}
            />
            <input
              type="text"
              placeholder='python "{file}"'
              value={newCmd()}
              onInput={(e) => setNewCmd(e.currentTarget.value)}
              class="col-span-7 px-2 py-1 rounded border text-xs font-mono"
              style={{
                background: "var(--color-bg)",
                color: "var(--color-fg)",
                "border-color": "var(--color-border)",
              }}
            />
            <button
              onClick={addRunMapVal}
              class="col-span-2 px-2 py-1 rounded text-xs transition-colors cursor-pointer font-semibold"
              style={{
                background: "var(--color-accent-dim, rgba(205, 255, 7, 0.15))",
                color: "var(--color-accent, #CDFF07)",
                border: "1px solid var(--color-accent, #CDFF07)",
              }}
            >
              Add
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
