import { createSignal, For } from "solid-js";
import {
  globalSettings,
  setGlobalSettings,
  saveGlobalSettings,
} from "../../stores/settings";
import { CustomSelect } from "./CustomSelect";

export function FileAssociationsForm() {
  const [newExt, setNewExt] = createSignal("");
  const [newType, setNewType] = createSignal<
    "text" | "image" | "pdf" | "markdown"
  >("text");

  const associations = () => globalSettings.fileAssociations || {};
  const entries = () => Object.entries(associations());

  const handleAdd = () => {
    let ext = newExt().trim().toLowerCase();
    if (!ext) return;
    if (ext.startsWith(".")) ext = ext.slice(1);

    setGlobalSettings("fileAssociations", (prev) => ({
      ...(prev || {}),
      [ext]: newType(),
    }));
    saveGlobalSettings();
    setNewExt("");
  };

  const handleRemove = (ext: string) => {
    setGlobalSettings("fileAssociations", (prev) => {
      const next = { ...prev } as Record<string, any>;
      delete next[ext];
      return next;
    });
    saveGlobalSettings();
  };

  const typeOptions = [
    { label: "Text Editor", value: "text" },
    { label: "Image Viewer", value: "image" },
    { label: "PDF Viewer", value: "pdf" },
    { label: "Markdown Editor", value: "markdown" },
  ];

  return (
    <div class="flex flex-col gap-4 mt-2">
      <p class="text-sm text-[var(--color-fg-muted)]">
        Override default editors for specific file extensions.
      </p>

      <div class="flex items-center gap-2">
        <input
          type="text"
          placeholder="Extension (e.g. log)"
          value={newExt()}
          onInput={(e) => setNewExt(e.currentTarget.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          class="w-48 px-3 py-1.5 rounded-md border text-sm"
          style={{
            background: "var(--color-bg-secondary)",
            color: "var(--color-fg)",
            "border-color": "var(--color-border)",
          }}
        />
        <CustomSelect
          value={newType()}
          options={typeOptions}
          onChange={(v) => setNewType(v as any)}
          width="160px"
        />
        <button
          onClick={handleAdd}
          class="px-4 py-1.5 rounded-md font-medium text-sm transition-colors"
          style={{
            background: "var(--color-accent)",
            color: "var(--color-bg)",
          }}
        >
          Add
        </button>
      </div>

      <div class="flex flex-col gap-2 mt-4">
        <For each={entries()}>
          {([ext, type]) => (
            <div class="flex items-center justify-between p-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] max-w-md">
              <div class="flex items-center gap-4">
                <span class="font-mono text-sm font-bold text-[var(--color-accent)]">
                  .{ext}
                </span>
                <span class="text-sm text-[var(--color-fg-muted)]">
                  {typeOptions.find((o) => o.value === type)?.label || type}
                </span>
              </div>
              <button
                onClick={() => handleRemove(ext)}
                class="text-sm px-2 py-1 hover:text-[var(--color-error)] text-[var(--color-fg-muted)] transition-colors"
              >
                Remove
              </button>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
