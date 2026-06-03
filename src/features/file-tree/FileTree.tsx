import { Show, For, createSignal } from "solid-js";
import type { FileEntry } from "../../types";
import { FileTreeNode, InlineInput, type EditingItem, type EditingMode } from "./FileTreeNode";
import { Folder, File, RefreshCw, Play, Terminal, Settings } from "lucide-solid";

interface FileTreeProps {
  tree: FileEntry[];
  rootPath: string | null;
  loading: boolean;
  width: number;
  onFileClick: (entry: FileEntry) => void;
  onToggleDir: (path: string) => void;
  onOpenFolder: () => void;
  onRefresh: () => void;
  onContextMenu?: (entry: FileEntry, e: MouseEvent) => void;
  onEmptyContextMenu?: (e: MouseEvent) => void;
  editingItem?: EditingItem | null;
  onSubmitEdit?: (parentPath: string, name: string, mode: EditingMode, originalName?: string) => void;
  onCancelEdit?: () => void;
  onStartEdit?: (parentPath: string, mode: EditingMode) => void;
  activeFilePath?: string;
  selectedPaths?: Set<string>;
  onSelectPaths?: (paths: Set<string>) => void;
  onRunScript?: () => void;
  onOpenSettings?: () => void;
  onToggleTerminal?: () => void;
}

export function FileTree(props: FileTreeProps) {
  const [anchorPath, setAnchorPath] = createSignal<string | null>(null);
  const [focusPath, setFocusPath] = createSignal<string | null>(null);

  // Helper to get a flattened list of visible entries
  function getVisibleEntries(): FileEntry[] {
    const visible: FileEntry[] = [];
    function walk(entries: FileEntry[]) {
      for (const entry of entries) {
        visible.push(entry);
        if (entry.isDirectory && entry.isExpanded && entry.children) {
          walk(entry.children);
        }
      }
    }
    walk(props.tree);
    return visible;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (props.editingItem) return; // Don't intercept if editing inline input
    
    const visible = getVisibleEntries();
    if (visible.length === 0) return;

    let currentIndex = -1;
    
    if (focusPath()) {
      currentIndex = visible.findIndex((v) => v.path === focusPath());
    }
    
    // Fallbacks if no explicit focus path is set
    if (currentIndex === -1 && props.selectedPaths && props.selectedPaths.size > 0) {
      const currentSelected = Array.from(props.selectedPaths);
      currentIndex = visible.findIndex((v) => v.path === currentSelected[currentSelected.length - 1]);
    }
    if (currentIndex === -1 && props.activeFilePath) {
      currentIndex = visible.findIndex((v) => v.path === props.activeFilePath);
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      
      if (currentIndex === -1) {
        // Nothing selected, pick first item
        const first = visible[0];
        props.onSelectPaths?.(new Set([first.path]));
        setAnchorPath(first.path);
        setFocusPath(first.path);
        return;
      }

      const nextIndex = e.key === "ArrowDown" 
        ? Math.min(currentIndex + 1, visible.length - 1)
        : Math.max(currentIndex - 1, 0);
        
      const nextEntry = visible[nextIndex];

      if (e.shiftKey) {
        // Multi-selection with shift
        const anchor = anchorPath() || visible[currentIndex].path;
        const anchorIndex = visible.findIndex((v) => v.path === anchor);
        const start = Math.min(anchorIndex, nextIndex);
        const end = Math.max(anchorIndex, nextIndex);
        
        const newSelection = new Set<string>();
        for (let i = start; i <= end; i++) {
          newSelection.add(visible[i].path);
        }
        props.onSelectPaths?.(newSelection);
        setFocusPath(nextEntry.path); // Update focus but keep anchor
      } else {
        // Single selection
        props.onSelectPaths?.(new Set([nextEntry.path]));
        setAnchorPath(nextEntry.path);
        setFocusPath(nextEntry.path);
      }
    } else if (e.key === "ArrowRight") {
      if (currentIndex !== -1) {
        e.preventDefault();
        const entry = visible[currentIndex];
        if (entry.isDirectory && !entry.isExpanded) {
          props.onToggleDir(entry.path);
        } else if (entry.isDirectory && entry.isExpanded && currentIndex + 1 < visible.length) {
          // Move to first child
          const next = visible[currentIndex + 1];
          props.onSelectPaths?.(new Set([next.path]));
          setAnchorPath(next.path);
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (currentIndex !== -1) {
        e.preventDefault();
        const entry = visible[currentIndex];
        if (entry.isDirectory && entry.isExpanded) {
          props.onToggleDir(entry.path);
        } else {
          // Go to parent directory
          const sep = entry.path.includes("\\") ? "\\" : "/";
          const lastSep = entry.path.lastIndexOf(sep);
          if (lastSep > 0) {
            const parentPath = entry.path.substring(0, lastSep);
            const parentIndex = visible.findIndex((v) => v.path === parentPath);
            if (parentIndex !== -1) {
              props.onSelectPaths?.(new Set([parentPath]));
              setAnchorPath(parentPath);
            }
          }
        }
      }
    } else if (e.key === "Enter") {
      if (currentIndex !== -1) {
        e.preventDefault();
        const entry = visible[currentIndex];
        if (entry.isDirectory) {
          props.onToggleDir(entry.path);
        } else {
          props.onFileClick(entry);
        }
      }
    }
  }

  return (
    <aside
      class="flex flex-col h-full shrink-0"
      style={{
        width: `${props.width}px`,
        background: "var(--color-sidebar-bg)",
        "border-right": "1px solid var(--color-border)",
      }}
    >
      <div
        class="flex items-center justify-between px-3 h-[32px] shrink-0 select-none"
        style={{
          "border-bottom": "1px solid var(--color-border)",
          color: "var(--color-fg-muted)",
        }}
      >
        <div class="flex items-center justify-between w-full">
          <Show when={props.rootPath}>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={() => props.onStartEdit?.(props.rootPath!, "new-file")}
              title="New File..."
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <File size={14} style={{ color: "var(--color-fg-muted)" }} />
            </button>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={() => props.onStartEdit?.(props.rootPath!, "new-folder")}
              title="New Folder..."
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <Folder size={14} style={{ color: "var(--color-fg-muted)" }} />
            </button>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={props.onRefresh}
              title="Refresh"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <RefreshCw size={14} style={{ color: "var(--color-fg-muted)" }} />
            </button>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={props.onRunScript}
              title="Run Script (.rune/settings.json)"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <Play size={14} fill="currentColor" style={{ color: "var(--color-fg-muted)" }} />
            </button>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={props.onToggleTerminal}
              title="Toggle Integrated Terminal"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <Terminal size={14} style={{ color: "var(--color-fg-muted)" }} />
            </button>
            <button
              class="hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-accent)] transition-colors p-1 rounded"
              onClick={props.onOpenSettings}
              title="Open Rune Settings"
              style={{ background: "none", border: "none", cursor: "pointer" }}
            >
              <Settings size={14} style={{ color: "var(--color-fg-muted)" }} />
            </button>
          </Show>
        </div>
      </div>

      <div
        class="flex-1 overflow-y-auto py-1 outline-none focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            props.onSelectPaths?.(new Set());
            setAnchorPath(null);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (e.target === e.currentTarget) {
            props.onEmptyContextMenu?.(e);
          }
        }}
      >
        <Show
          when={props.rootPath}
          fallback={
            <div class="flex flex-col items-center justify-center h-full gap-3 px-4">
              <p class="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                No folder opened
              </p>
              <button
                class="text-xs px-3 py-1.5"
                style={{
                  border: "1px solid var(--color-border)",
                  color: "var(--color-accent)",
                  "border-radius": "0px",
                }}
                onClick={props.onOpenFolder}
              >
                Open Folder
              </button>
            </div>
          }
        >
          <Show
            when={!props.loading}
            fallback={
              <div class="flex items-center justify-center h-8">
                <span class="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                  Loading...
                </span>
              </div>
            }
          >
            <div
              class="px-3 py-1 text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {props.rootPath?.split(/[\\/]/).pop()}
            </div>
            <Show when={props.editingItem?.parentPath === props.rootPath && (props.editingItem.mode === "new-file" || props.editingItem.mode === "new-folder")}>
              <InlineInput
                depth={0}
                initialValue=""
                icon={props.editingItem!.mode === "new-folder" ? "folder" : "file"}
                onSubmit={(name) => props.onSubmitEdit?.(props.rootPath!, name, props.editingItem!.mode)}
                onCancel={() => props.onCancelEdit?.()}
              />
            </Show>
            <For each={props.tree}>
              {(entry) => (
                <FileTreeNode
                  entry={entry}
                  depth={0}
                  parentExpanded={[]}
                  onFileClick={props.onFileClick}
                  onToggleDir={props.onToggleDir}
                  onContextMenu={props.onContextMenu}
                  activeFilePath={props.activeFilePath}
                  selectedPaths={props.selectedPaths}
                  onSelectPaths={(paths) => {
                    // Update anchor on explicit click
                    if (paths.size === 1) {
                      setAnchorPath(Array.from(paths)[0]);
                    }
                    props.onSelectPaths?.(paths);
                  }}
                  editingItem={props.editingItem}
                  onSubmitEdit={props.onSubmitEdit}
                  onCancelEdit={props.onCancelEdit}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>
    </aside>
  );
}
