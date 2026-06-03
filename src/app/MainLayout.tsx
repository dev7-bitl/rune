import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import { Titlebar } from "../features/titlebar";
import { FileTree } from "../features/file-tree";
import { Editor, TabBar } from "../features/editor";
import { ContextMenu, type ContextMenuItem } from "../components/ContextMenu";
import { CommandPalette } from "../components/CommandPalette";
import { WelcomeScreen } from "../features/welcome/WelcomeScreen";
import { QuickPick } from "../components/QuickPick";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { WorkspaceSearch } from "../components/WorkspaceSearch";
import { TerminalPanel } from "../components/TerminalPanel";

import { useFileSystem } from "../hooks/useFileSystem";
import { useAppStartup } from "../hooks/useAppStartup";
import { useWorkspaceSync } from "../hooks/useWorkspaceSync";
import { useEditorActions } from "../hooks/useEditorActions";
import { useExplorerActions } from "../hooks/useExplorerActions";
import { useTabContextMenu } from "../hooks/useTabContextMenu";
import { useAppCommands } from "../hooks/useAppCommands";

import { globalSettings, settingsStore } from "../stores/settings";
import { tabStore } from "../stores/tabs";
import type { EditingMode } from "../features/file-tree/FileTreeNode";

export function MainLayout() {
  const fs = useFileSystem();

  // Local State
  const [ctxMenu, setCtxMenu] = createSignal<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);
  const [showCommandPalette, setShowCommandPalette] = createSignal(false);
  const [palettePrefix, setPalettePrefix] = createSignal("");
  const [showWorkspaceSearch, setShowWorkspaceSearch] = createSignal(false);
  const [showTerminal, setShowTerminal] = createSignal(false);
  const [terminalHeight, setTerminalHeight] = createSignal(240);
  const [editingItem, setEditingItem] = createSignal<{
    parentPath: string;
    mode: EditingMode;
  } | null>(null);
  const [confirmState, setConfirmState] = createSignal<{
    message: string;
    detail?: string;
    okLabel?: string;
    cancelLabel?: string;
    variant?: "primary" | "danger";
    hideCancel?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [quickPickState, setQuickPickState] = createSignal<{
    items: { id: string; label: string; detail?: string }[];
    placeholder?: string;
    onSelect: (id: string | undefined) => void;
  } | null>(null);
  const [selectedPaths, setSelectedPaths] = createSignal<Set<string>>(
    new Set(),
  );

  function showContextMenu(x: number, y: number, items: ContextMenuItem[]) {
    setCtxMenu({ x, y, items });
  }

  function showConfirmDialog(
    message: string,
    options?: {
      detail?: string;
      okLabel?: string;
      cancelLabel?: string;
      variant?: "primary" | "danger";
      hideCancel?: boolean;
    },
  ): Promise<boolean> {
    return new Promise((resolve) => {
      setConfirmState({
        message,
        detail: options?.detail,
        okLabel: options?.okLabel,
        cancelLabel: options?.cancelLabel,
        variant: options?.variant,
        hideCancel: options?.hideCancel,
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(null);
          resolve(false);
        },
      });
    });
  }

  function showQuickPick(
    items: { id: string; label: string; detail?: string }[],
    options?: { placeholder?: string },
  ): Promise<string | undefined> {
    return new Promise((resolve) => {
      setQuickPickState({
        items,
        placeholder: options?.placeholder,
        onSelect: (id) => {
          setQuickPickState(null);
          resolve(id);
        },
      });
    });
  }

  function confirmDelete(name: string, onConfirm: () => void) {
    showConfirmDialog(`Delete "${name}"?`, {
      detail: "This action cannot be undone.",
      okLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "danger",
    }).then((confirmed) => {
      if (confirmed) {
        onConfirm();
      }
    });
  }

  function handleEditorChange(content: string, tabId: string) {
    tabStore.updateTabContent(tabId, content);
  }

  // Hooks Initialization
  const {
    deleteSelectedPaths,
    handleFileClick,
    handleFileTreeContextMenu,
    handleEmptyContextMenu,
    handleSubmitEdit,
  } = useExplorerActions({
    fs,
    selectedPaths,
    setSelectedPaths,
    setEditingItem,
    showContextMenu,
    confirmDelete,
  });

  useAppStartup({
    fs,
    toggleTerminal: () => setShowTerminal((prev) => !prev),
    toggleWorkspaceSearch: () => setShowWorkspaceSearch((prev) => !prev),
    toggleCommandPalette: () => {
      setPalettePrefix(">");
      setShowCommandPalette((prev) => !prev);
    },
    openSettings: () =>
      tabStore.openTab(
        "rune://settings",
        "Settings",
        "",
        "settings",
        "settings",
      ),
    handleFileClick,
    showConfirmDialog,
    showQuickPick,
  });

  useWorkspaceSync({ fs });

  const {
    handleSave,
    handleSaveAll,
    handleSaveAs,
    handleCloseTab,
    triggerEditorCommand,
  } = useEditorActions({ fs });

  const { handleTabContextMenu } = useTabContextMenu({ showContextMenu });

  const { menus, commands } = useAppCommands({
    fs,
    handleSave,
    handleSaveAll,
    handleSaveAs,
    handleCloseTab,
    setShowTerminal,
    setShowCommandPalette: (show: boolean) => {
      setPalettePrefix(">");
      setShowCommandPalette(show);
    },
    setShowWorkspaceSearch,
    deleteSelectedPaths,
    triggerEditorCommand,
    openPaletteWithPrefix: (prefix: string) => {
      setPalettePrefix(prefix);
      setShowCommandPalette(true);
    },
  });

  // Global Settings Effects
  createEffect(() => {
    document.documentElement.style.setProperty(
      "--editor-font-size",
      `${globalSettings.editorFontSize}px`,
    );
    document.documentElement.style.setProperty(
      "--terminal-font-size",
      `${globalSettings.terminalFontSize}px`,
    );
    document.documentElement.style.setProperty(
      "--editor-font-family",
      globalSettings.editorFontFamily,
    );
  });

  createEffect(() => {
    const current = fs.rootPath();
    if (current) {
      window.dispatchEvent(
        new CustomEvent("rune-workspace-changed", { detail: current }),
      );
    }
  });

  // Listen for open-folder events dispatched by plugins (e.g. open-recent)
  onMount(() => {
    function handleOpenFolderEvent(e: Event) {
      const path = (e as CustomEvent<string>).detail;
      if (path) fs.openFolderByPath(path).catch(console.error);
    }
    function handleOpenFileEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.path) {
        handleFileClick({
          path: detail.path,
          name: detail.name || detail.path.split(/[\\/]/).pop() || "",
        });
      }
    }
    window.addEventListener("rune-open-folder", handleOpenFolderEvent);
    window.addEventListener("rune-open-file", handleOpenFileEvent);

    function handleOpenPaletteEvent(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.prefix != null) {
        setPalettePrefix(detail.prefix);
        setShowCommandPalette(true);
      }
    }
    window.addEventListener("rune-open-palette", handleOpenPaletteEvent);

    onCleanup(() => {
      window.removeEventListener("rune-open-folder", handleOpenFolderEvent);
      window.removeEventListener("rune-open-file", handleOpenFileEvent);
      window.removeEventListener("rune-open-palette", handleOpenPaletteEvent);
    });
  });

  const windowTitle = () => {
    const tab = tabStore.getFocusedTab();
    if (tab) {
      return `${tab.isDirty ? "● " : ""}${tab.fileName} — Rune Editor`;
    }
    return "Rune Editor";
  };

  const leftActiveTab = () => tabStore.getActiveTab();
  const rightActiveTab = () => tabStore.getRightActiveTab();

  return (
    <div
      class="h-screen w-screen flex flex-col overflow-hidden"
      style={{ background: "var(--color-bg)", color: "var(--color-fg)" }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <Titlebar menus={menus()} title={windowTitle()} />
      <Show
        when={
          fs.rootPath() ||
          tabStore.leftTabs().length > 0 ||
          tabStore.rightTabs().length > 0
        }
        fallback={
          <WelcomeScreen
            onOpenCommandPalette={() => {
              setPalettePrefix(">");
              setShowCommandPalette(true);
            }}
          />
        }
      >
        <div class="flex flex-1 overflow-hidden">
          {settingsStore.sidebarVisible() && (
            <>
              <FileTree
                tree={fs.tree()}
                rootPath={fs.rootPath()}
                loading={fs.loading()}
                width={settingsStore.sidebarWidth()}
                onFileClick={(entry) => handleFileClick(entry, "left")}
                onToggleDir={fs.toggleDirectory}
                onOpenFolder={() => fs.openFolder()}
                onRefresh={() => fs.refreshTree()}
                onContextMenu={(entry, e) =>
                  handleFileTreeContextMenu(entry, e)
                }
                onEmptyContextMenu={handleEmptyContextMenu}
                activeFilePath={leftActiveTab()?.filePath}
                selectedPaths={selectedPaths()}
                onSelectPaths={setSelectedPaths}
                editingItem={editingItem()}
                onStartEdit={(parentPath, mode) =>
                  setEditingItem({ parentPath, mode })
                }
                onSubmitEdit={handleSubmitEdit}
                onCancelEdit={() => setEditingItem(null)}
              />
              <div
                class="w-[3px] shrink-0 cursor-col-resize hover:bg-[var(--color-accent)] transition-colors"
                style={{ background: "var(--color-border)" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = settingsStore.sidebarWidth();
                  function onMove(ev: MouseEvent) {
                    const delta = ev.clientX - startX;
                    settingsStore.setSidebarWidth(
                      Math.max(150, Math.min(500, startWidth + delta)),
                    );
                  }
                  function onUp() {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  }
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />
            </>
          )}
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 flex overflow-hidden">
              {/* Left Pane */}
              <div
                class="flex flex-col overflow-hidden pane-left"
                style={{
                  width: settingsStore.splitActive()
                    ? `${settingsStore.splitWidth()}%`
                    : "100%",
                }}
                onMouseDown={() => tabStore.setFocusedPane("left")}
              >
                <TabBar
                  tabs={tabStore.leftTabs()}
                  activeTabId={tabStore.activeTabId()}
                  onTabClick={(id) => tabStore.setActiveTabForPane(id, "left")}
                  onTabClose={(id) => {
                    const result = tabStore.closeTab(id);
                    if (
                      result.paneCleared === "left" &&
                      !tabStore.rightTabs().length
                    ) {
                      settingsStore.setSplitActive(false);
                    }
                  }}
                  onTabContextMenu={(id, e) =>
                    handleTabContextMenu(id, "left", e)
                  }
                />
                <Editor
                  content={leftActiveTab()?.content ?? ""}
                  language={leftActiveTab()?.language ?? "text"}
                  isDirty={leftActiveTab()?.isDirty ?? false}
                  hasOpenFile={!!leftActiveTab()}
                  onChange={(content) => {
                    const tab = leftActiveTab();
                    if (tab) handleEditorChange(content, tab.id);
                  }}
                  tabId={leftActiveTab()?.id ?? null}
                  fileType={leftActiveTab()?.fileType ?? "text"}
                  dataUrl={leftActiveTab()?.dataUrl}
                  fileName={leftActiveTab()?.fileName}
                  onCreateFile={() => tabStore.openUntitledTab()}
                  onOpenFolder={() => fs.openFolder()}
                  onOpenCommandPalette={() => {
                    setPalettePrefix(">");
                    setShowCommandPalette(true);
                  }}
                  onSearchWorkspace={() => setShowWorkspaceSearch(true)}
                />
              </div>

              {/* Split Divider */}
              <Show when={settingsStore.splitActive()}>
                <div
                  class="w-[3px] shrink-0 cursor-col-resize hover:bg-[var(--color-accent)] transition-colors relative group"
                  style={{ background: "var(--color-border)" }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const parent = (e.currentTarget as HTMLElement)
                      .parentElement;
                    if (!parent) return;
                    const startX = e.clientX;
                    const parentWidth = parent.clientWidth;
                    const startPct = settingsStore.splitWidth();
                    function onMove(ev: MouseEvent) {
                      const delta = ev.clientX - startX;
                      const deltaPct = (delta / parentWidth) * 100;
                      settingsStore.setSplitWidth(
                        Math.max(20, Math.min(80, startPct + deltaPct)),
                      );
                    }
                    function onUp() {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                    }
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                >
                  <button
                    class="absolute -top-[1px] right-0 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    style={{
                      background: "var(--color-bg-secondary)",
                      border: "1px solid var(--color-border)",
                      color: "var(--color-fg-muted)",
                      cursor: "pointer",
                      "font-size": "10px",
                    }}
                    onClick={() => {
                      const rightTabs = tabStore.rightTabs();
                      for (const t of rightTabs) {
                        tabStore.moveTabToPane(t.id, "left");
                      }
                      settingsStore.setSplitActive(false);
                    }}
                    title="Close split"
                  >
                    <svg
                      width="8"
                      height="8"
                      viewBox="0 0 8 8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <line x1="1" y1="1" x2="7" y2="7" />
                      <line x1="7" y1="1" x2="1" y2="7" />
                    </svg>
                  </button>
                </div>
              </Show>

              {/* Right Pane */}
              <Show when={settingsStore.splitActive()}>
                <div
                  class="flex flex-col overflow-hidden pane-right"
                  style={{ width: `${100 - settingsStore.splitWidth()}%` }}
                  onMouseDown={() => tabStore.setFocusedPane("right")}
                >
                  <TabBar
                    tabs={tabStore.rightTabs()}
                    activeTabId={tabStore.rightActiveTabId()}
                    onTabClick={(id) =>
                      tabStore.setActiveTabForPane(id, "right")
                    }
                    onTabClose={(id) => {
                      const result = tabStore.closeTab(id);
                      if (result.paneCleared === "right") {
                        settingsStore.setSplitActive(false);
                      }
                    }}
                    onTabContextMenu={(id, e) =>
                      handleTabContextMenu(id, "right", e)
                    }
                  />
                  <Editor
                    content={rightActiveTab()?.content ?? ""}
                    language={rightActiveTab()?.language ?? "text"}
                    isDirty={rightActiveTab()?.isDirty ?? false}
                    hasOpenFile={!!rightActiveTab()}
                    onChange={(content) => {
                      const tab = rightActiveTab();
                      if (tab) handleEditorChange(content, tab.id);
                    }}
                    tabId={rightActiveTab()?.id ?? null}
                    fileType={rightActiveTab()?.fileType ?? "text"}
                    dataUrl={rightActiveTab()?.dataUrl}
                    fileName={rightActiveTab()?.fileName}
                    onCreateFile={() => tabStore.openUntitledTab()}
                    onOpenFolder={() => fs.openFolder()}
                    onOpenCommandPalette={() => {
                      setPalettePrefix(">");
                      setShowCommandPalette(true);
                    }}
                    onSearchWorkspace={() => setShowWorkspaceSearch(true)}
                  />
                </div>
              </Show>
            </div>
            <Show when={showTerminal()}>
              <div
                class="w-full h-[3px] shrink-0 cursor-row-resize hover:bg-[var(--color-accent)] transition-colors relative z-10"
                style={{ background: "var(--color-border)" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startHeight = terminalHeight();
                  function onMove(ev: MouseEvent) {
                    const delta = startY - ev.clientY;
                    const newHeight = Math.max(
                      100,
                      Math.min(window.innerHeight * 0.8, startHeight + delta),
                    );
                    setTerminalHeight(newHeight);
                  }
                  function onUp() {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  }
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />
              <div
                style={{ height: `${terminalHeight()}px` }}
                class="flex flex-col shrink-0 overflow-hidden"
              >
                <TerminalPanel
                  onClose={() => setShowTerminal(false)}
                  rootPath={fs.rootPath()}
                />
              </div>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={ctxMenu()}>
        {(cm) => (
          <ContextMenu
            x={cm().x}
            y={cm().y}
            items={cm().items}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </Show>
      <Show when={showCommandPalette()}>
        <CommandPalette
          commands={commands()}
          onClose={() => setShowCommandPalette(false)}
          initialPrefix={palettePrefix()}
        />
      </Show>
      <Show when={showWorkspaceSearch()}>
        <WorkspaceSearch
          rootPath={fs.rootPath()}
          onClose={() => setShowWorkspaceSearch(false)}
          onResultClick={(filePath: string) => {
            setShowWorkspaceSearch(false);
            handleFileClick({
              path: filePath,
              name: filePath.split(/[\\/]/).pop() || "",
            });
          }}
        />
      </Show>
      <Show when={confirmState()}>
        {(c) => (
          <ConfirmDialog
            message={c().message}
            detail={c().detail}
            okLabel={c().okLabel}
            cancelLabel={c().cancelLabel}
            variant={c().variant}
            hideCancel={c().hideCancel}
            onConfirm={c().onConfirm}
            onCancel={c().onCancel}
          />
        )}
      </Show>
      <Show when={quickPickState()}>
        {(qp) => (
          <QuickPick
            items={qp().items}
            placeholder={qp().placeholder}
            onSelect={qp().onSelect}
          />
        )}
      </Show>
    </div>
  );
}
