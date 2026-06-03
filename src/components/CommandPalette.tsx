import { createSignal, createEffect, For, Show, onMount } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { tabStore } from "../stores/tabs";

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
  category?: string;
}

interface Symbol {
  name: string;
  kind: string;
  line: number;
  path: string;
}

type PaletteMode = "command" | "file" | "workspace-symbol" | "document-symbol";

interface CommandPaletteProps {
  commands: CommandItem[];
  onClose: () => void;
  initialPrefix?: string;
}

// ── Symbol kind icon data ──
const SYMBOL_ICONS: Record<
  string,
  { d: string; color: string; label: string }
> = {
  function: {
    d: "M4 17.5V6.5L8 12l-4 5.5M12 6.5l4 5.5-4 5.5M20 6.5v11",
    color: "#b180d7",
    label: "fn",
  },
  fn: {
    d: "M4 17.5V6.5L8 12l-4 5.5M12 6.5l4 5.5-4 5.5M20 6.5v11",
    color: "#b180d7",
    label: "fn",
  },
  def: {
    d: "M4 17.5V6.5L8 12l-4 5.5M12 6.5l4 5.5-4 5.5M20 6.5v11",
    color: "#b180d7",
    label: "fn",
  },
  class: {
    d: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    color: "#e5c07b",
    label: "C",
  },
  struct: {
    d: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18",
    color: "#56b6c2",
    label: "S",
  },
  const: { d: "M12 2L2 7l10 5 10-5-10-5z", color: "#4fc1ff", label: "K" },
};
const DEFAULT_ICON = {
  d: "M4 17.5V6.5L8 12l-4 5.5M12 6.5l4 5.5-4 5.5M20 6.5v11",
  color: "#7a8394",
  label: "?",
};

// ── File extension → color ──
const EXT_COLORS: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f0db4f",
  jsx: "#f0db4f",
  rs: "#dea584",
  py: "#3572A5",
  html: "#e34c26",
  css: "#563d7c",
  json: "#cbcb41",
  md: "#519aba",
  toml: "#9c4221",
  yaml: "#cb171e",
  vue: "#41b883",
  go: "#00add8",
  java: "#b07219",
  cpp: "#f34b7d",
  sql: "#e38c00",
  php: "#4f5d95",
  xml: "#0060ac",
  sh: "#89e051",
};

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_COLORS[ext] ?? "var(--color-fg-muted)";
}

// ── Fuzzy match highlighter ──
function highlightMatch(text: string, query: string) {
  if (!query) return <span>{text}</span>;
  const lowerText = text.toLowerCase();
  const lowerQ = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQ);
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <span style={{ color: "var(--color-accent)", "font-weight": "600" }}>
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </span>
  );
}

// ── Shortcut badge renderer ──
function ShortcutBadge(props: { shortcut: string }) {
  const parts = props.shortcut.split("+");
  return (
    <span class="flex items-center gap-0.5 shrink-0 ml-auto pl-4">
      <For each={parts}>
        {(part, i) => (
          <>
            <kbd
              class="text-[10px] leading-none px-[5px] py-[2px] rounded"
              style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-fg-muted)",
                "font-family":
                  "'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace",
                "font-weight": "500",
                "min-width": "18px",
                "text-align": "center",
                display: "inline-block",
              }}
            >
              {part.trim()}
            </kbd>
            <Show when={i() < parts.length - 1}>
              <span
                class="text-[8px] opacity-40"
                style={{ color: "var(--color-fg-muted)" }}
              >
                +
              </span>
            </Show>
          </>
        )}
      </For>
    </span>
  );
}

export function CommandPalette(props: CommandPaletteProps) {
  const [rawQuery, setRawQuery] = createSignal(props.initialPrefix ?? "");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [symbols, setSymbols] = createSignal<Symbol[]>([]);
  const [fileList, setFileList] = createSignal<string[]>([]);
  const [loadingSymbols, setLoadingSymbols] = createSignal(false);
  let inputRef!: HTMLInputElement;
  let listRef!: HTMLDivElement;
  let dialogRef!: HTMLDivElement;

  const mode = (): PaletteMode => {
    const q = rawQuery();
    if (q.startsWith(">")) return "command";
    if (q.startsWith("#")) return "workspace-symbol";
    if (q.startsWith("@")) return "document-symbol";
    return "file";
  };

  const searchText = (): string => {
    const q = rawQuery();
    const m = mode();
    if (
      m === "command" ||
      m === "workspace-symbol" ||
      m === "document-symbol"
    ) {
      return q.slice(1).trim();
    }
    return q.trim();
  };

  const placeholder = (): string => {
    switch (mode()) {
      case "command":
        return "Search commands...";
      case "workspace-symbol":
        return "Search workspace symbols...";
      case "document-symbol":
        return "Go to symbol in editor...";
      case "file":
        return "Go to file...";
    }
  };

  // ── Data fetching ──
  function fetchFiles() {
    invoke<string[]>("get_indexed_files")
      .then((files) => setFileList(files))
      .catch(() => setFileList([]));
  }

  onMount(() => {
    fetchFiles();
  });

  createEffect(() => {
    if (mode() === "file") fetchFiles();
  });

  createEffect(() => {
    const m = mode();
    if (m === "workspace-symbol") {
      setLoadingSymbols(true);
      invoke<Symbol[]>("get_workspace_symbols", { query: searchText() })
        .then((s) => {
          setSymbols(s);
          setSelectedIndex(0);
        })
        .finally(() => setLoadingSymbols(false));
    } else if (m === "document-symbol") {
      const filePath = tabStore.getFocusedTab()?.filePath;
      if (filePath) {
        setLoadingSymbols(true);
        invoke<Symbol[]>("get_document_symbols", { path: filePath })
          .then((s) => {
            setSymbols(s);
            setSelectedIndex(0);
          })
          .finally(() => setLoadingSymbols(false));
      } else {
        setSymbols([]);
      }
    }
  });

  // ── Filtering ──
  const filteredCommands = () => {
    const q = searchText().toLowerCase();
    if (!q) return props.commands;
    return props.commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q),
    );
  };

  const filteredSymbols = () => {
    const q = searchText().toLowerCase();
    const s = symbols();
    if (!q) return s;
    return s.filter((sym) => sym.name.toLowerCase().includes(q));
  };

  const filteredFiles = () => {
    const q = searchText().toLowerCase();
    const files = fileList();
    if (!q) return files.slice(0, 60);
    return files
      .filter((f) => (f.split(/[\\/]/).pop()?.toLowerCase() ?? "").includes(q))
      .slice(0, 60);
  };

  const totalItems = (): number => {
    switch (mode()) {
      case "command":
        return filteredCommands().length;
      case "workspace-symbol":
      case "document-symbol":
        return filteredSymbols().length;
      case "file":
        return filteredFiles().length;
    }
  };

  onMount(() => {
    inputRef?.focus();
    if (props.initialPrefix) {
      const len = props.initialPrefix.length;
      inputRef.setSelectionRange(len, len);
    }
  });

  function executeSelected() {
    const idx = selectedIndex();
    const m = mode();
    if (m === "command") {
      const items = filteredCommands();
      if (items[idx]) {
        props.onClose();
        items[idx].action();
      }
    } else if (m === "workspace-symbol" || m === "document-symbol") {
      const items = filteredSymbols();
      if (items[idx]) {
        const sym = items[idx];
        props.onClose();
        window.dispatchEvent(
          new CustomEvent("rune-open-file", { detail: { path: sym.path } }),
        );
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("rune-goto-line-path", {
              detail: { path: sym.path, line: sym.line },
            }),
          );
        }, 150);
      }
    } else if (m === "file") {
      const items = filteredFiles();
      if (items[idx]) {
        props.onClose();
        window.dispatchEvent(
          new CustomEvent("rune-open-file", { detail: { path: items[idx] } }),
        );
      }
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    const total = totalItems();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((p) => Math.min(p + 1, Math.max(0, total - 1)));
      scrollTo();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((p) => Math.max(p - 1, 0));
      scrollTo();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    } else if (e.key === "Escape") {
      e.preventDefault();
      props.onClose();
    }
  }

  function scrollTo() {
    requestAnimationFrame(() => {
      const el = listRef?.children[selectedIndex()] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  function handleBackdropMouseDown(e: MouseEvent) {
    if (dialogRef && !dialogRef.contains(e.target as Node)) props.onClose();
  }

  // ── Row styles ──
  const rowBase =
    "w-full flex items-center gap-2.5 px-3 py-[5px] text-[12px] text-left border-none cursor-pointer";
  function rowStyle(idx: number) {
    return {
      color: "var(--color-fg)",
      background:
        selectedIndex() === idx ? "var(--color-bg-tertiary)" : "transparent",
      transition: "background 60ms ease",
    };
  }

  // ── Mode badge config ──
  const modeBadge = (): { label: string; bg: string } | null => {
    switch (mode()) {
      case "command":
        return { label: "COMMANDS", bg: "var(--color-accent)" };
      case "workspace-symbol":
        return { label: "SYMBOLS", bg: "#b180d7" };
      case "document-symbol":
        return { label: "OUTLINE", bg: "#56b6c2" };
      default:
        return null;
    }
  };

  return (
    <div
      class="fixed inset-0 flex justify-center items-start"
      style={{
        "z-index": 200,
        background: "rgba(0,0,0,0.45)",
        "backdrop-filter": "blur(4px)",
        "-webkit-backdrop-filter": "blur(4px)",
        "padding-top": "14vh",
      }}
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        data-command-palette
        class="flex flex-col shrink-0 overflow-hidden"
        style={{
          width: "580px",
          "max-height": "420px",
          background: "var(--color-bg-secondary)",
          border: "1px solid var(--color-border)",
          "border-radius": "10px",
          "box-shadow":
            "0 16px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04) inset",
        }}
      >
        {/* ── Input bar ── */}
        <div
          class="flex items-center px-3 shrink-0 gap-2.5"
          style={{
            height: "40px",
            "border-bottom": "1px solid var(--color-border)",
          }}
        >
          {/* Search icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-fg-muted)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0"
            style={{ opacity: "0.5" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* Mode badge */}
          <Show when={modeBadge()}>
            {(badge) => (
              <span
                class="text-[9px] px-[6px] py-[2px] rounded shrink-0 uppercase tracking-wider"
                style={{
                  background: badge().bg,
                  color: "#fff",
                  "font-weight": "700",
                  "letter-spacing": "0.06em",
                }}
              >
                {badge().label}
              </span>
            )}
          </Show>
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder()}
            value={rawQuery()}
            onInput={(e) => {
              setRawQuery(e.currentTarget.value);
              setSelectedIndex(0);
            }}
            onkeydown={handleKeydown}
            class="w-full bg-transparent outline-none text-[13px]"
            style={{
              color: "var(--color-fg)",
              "font-family": "'Inter', 'Segoe UI', system-ui, sans-serif",
              "caret-color": "var(--color-accent)",
            }}
          />
          {/* Result count */}
          <span
            class="text-[10px] shrink-0 tabular-nums"
            style={{ color: "var(--color-fg-muted)", opacity: "0.6" }}
          >
            {totalItems()}
          </span>
        </div>

        {/* ── Hint bar for empty state ── */}
        <Show when={mode() === "file" && rawQuery() === ""}>
          <div
            class="flex items-center gap-3 px-3 py-[6px] shrink-0"
            style={{
              "border-bottom": "1px solid var(--color-border)",
              background: "var(--color-bg)",
            }}
          >
            <span
              class="text-[10px]"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <kbd
                class="text-[9px] px-1 py-px rounded mr-0.5"
                style={{
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                &gt;
              </kbd>{" "}
              commands
            </span>
            <span
              class="text-[10px]"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <kbd
                class="text-[9px] px-1 py-px rounded mr-0.5"
                style={{
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                #
              </kbd>{" "}
              symbols
            </span>
            <span
              class="text-[10px]"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <kbd
                class="text-[9px] px-1 py-px rounded mr-0.5"
                style={{
                  background: "var(--color-bg-secondary)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                @
              </kbd>{" "}
              outline
            </span>
          </div>
        </Show>

        {/* ── Result list ── */}
        <div
          ref={listRef}
          class="flex-1 overflow-y-auto py-0.5"
          style={{ "scrollbar-width": "thin" }}
        >
          {/* Command mode */}
          <Show when={mode() === "command"}>
            <For each={filteredCommands()}>
              {(item, i) => (
                <button
                  class={rowBase}
                  style={rowStyle(i())}
                  onMouseEnter={() => setSelectedIndex(i())}
                  onClick={() => {
                    props.onClose();
                    item.action();
                  }}
                >
                  {/* Chevron icon for commands */}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--color-fg-muted)"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="shrink-0"
                    style={{ opacity: "0.4" }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span class="flex-1 truncate">
                    <Show when={item.category}>
                      <span
                        style={{
                          color: "var(--color-fg-muted)",
                          "font-weight": "400",
                        }}
                      >
                        {item.category}:{" "}
                      </span>
                    </Show>
                    {highlightMatch(item.label, searchText())}
                  </span>
                  <Show when={item.shortcut}>
                    <ShortcutBadge shortcut={item.shortcut!} />
                  </Show>
                </button>
              )}
            </For>
            <Show when={filteredCommands().length === 0}>
              <EmptyState text="No matching commands" />
            </Show>
          </Show>

          {/* Symbol modes */}
          <Show
            when={mode() === "workspace-symbol" || mode() === "document-symbol"}
          >
            <Show when={loadingSymbols()}>
              <EmptyState text="Indexing symbols..." />
            </Show>
            <Show when={!loadingSymbols()}>
              <For each={filteredSymbols()}>
                {(sym, i) => {
                  const icon = SYMBOL_ICONS[sym.kind] ?? DEFAULT_ICON;
                  const fileName = sym.path.split(/[\\/]/).pop() ?? "";
                  return (
                    <button
                      class={rowBase}
                      style={rowStyle(i())}
                      onMouseEnter={() => setSelectedIndex(i())}
                      onClick={() => {
                        props.onClose();
                        window.dispatchEvent(
                          new CustomEvent("rune-open-file", {
                            detail: { path: sym.path },
                          }),
                        );
                        setTimeout(() => {
                          window.dispatchEvent(
                            new CustomEvent("rune-goto-line-path", {
                              detail: { path: sym.path, line: sym.line },
                            }),
                          );
                        }, 150);
                      }}
                    >
                      {/* Symbol icon */}
                      <span
                        class="flex items-center justify-center shrink-0 rounded text-[9px] font-bold"
                        style={{
                          width: "18px",
                          height: "18px",
                          background: icon.color + "20",
                          color: icon.color,
                          "letter-spacing": "0",
                        }}
                      >
                        {icon.label}
                      </span>
                      <span class="flex-1 truncate font-medium">
                        {highlightMatch(sym.name, searchText())}
                      </span>
                      <span
                        class="text-[10px] shrink-0 truncate max-w-[200px]"
                        style={{
                          color: "var(--color-fg-muted)",
                          opacity: "0.6",
                        }}
                      >
                        {fileName}
                        {mode() === "workspace-symbol" ? `:${sym.line}` : ""}
                      </span>
                    </button>
                  );
                }}
              </For>
              <Show when={filteredSymbols().length === 0}>
                <EmptyState
                  text={
                    mode() === "document-symbol" &&
                    !tabStore.getFocusedTab()?.filePath
                      ? "No active file open"
                      : "No symbols found"
                  }
                />
              </Show>
            </Show>
          </Show>

          {/* File mode */}
          <Show when={mode() === "file"}>
            <For each={filteredFiles()}>
              {(filePath, i) => {
                const fileName = filePath.split(/[\\/]/).pop() ?? "";
                const dirParts = filePath.split(/[\\/]/);
                const dirPath =
                  dirParts.length > 3
                    ? "…/" + dirParts.slice(-3, -1).join("/")
                    : dirParts.slice(0, -1).join("/");
                const color = getFileColor(fileName);
                return (
                  <button
                    class={rowBase}
                    style={rowStyle(i())}
                    onMouseEnter={() => setSelectedIndex(i())}
                    onClick={() => {
                      props.onClose();
                      window.dispatchEvent(
                        new CustomEvent("rune-open-file", {
                          detail: { path: filePath },
                        }),
                      );
                    }}
                  >
                    {/* File icon */}
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={color}
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      class="shrink-0"
                      style={{ opacity: "0.8" }}
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span class="flex-1 truncate">
                      {highlightMatch(fileName, searchText())}
                    </span>
                    <span
                      class="text-[10px] shrink-0 truncate max-w-[220px]"
                      style={{ color: "var(--color-fg-muted)", opacity: "0.5" }}
                    >
                      {dirPath}
                    </span>
                  </button>
                );
              }}
            </For>
            <Show when={filteredFiles().length === 0}>
              <EmptyState
                text={
                  searchText()
                    ? "No matching files"
                    : "Open a workspace to search files"
                }
              />
            </Show>
          </Show>
        </div>

        {/* ── Footer bar ── */}
        <div
          class="flex items-center justify-between px-3 shrink-0"
          style={{
            height: "28px",
            "border-top": "1px solid var(--color-border)",
            background: "var(--color-bg)",
          }}
        >
          <span
            class="text-[10px] flex items-center gap-2"
            style={{ color: "var(--color-fg-muted)", opacity: "0.5" }}
          >
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </span>
          <span
            class="text-[9px] tracking-wider uppercase"
            style={{
              color: "var(--color-fg-muted)",
              opacity: "0.35",
              "font-weight": "600",
            }}
          >
            Rune
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptyState(props: { text: string }) {
  return (
    <div
      class="px-4 py-6 text-center text-[11px]"
      style={{ color: "var(--color-fg-muted)", opacity: "0.7" }}
    >
      {props.text}
    </div>
  );
}
