import { TabBar, Editor } from "../features/editor";
import { tabStore } from "../stores/tabs";
import { settingsStore } from "../stores/settings";
import type { PaneSide } from "../types";

interface EditorPaneProps {
  pane: PaneSide;
  fs: any;
  onTabContextMenu: (id: string, pane: PaneSide, e: MouseEvent) => void;
  handleEditorChange: (content: string, tabId: string) => void;
  setPalettePrefix: (p: string) => void;
  setShowCommandPalette: (s: boolean) => void;
  setShowWorkspaceSearch: (s: boolean) => void;
}

export function EditorPane(props: EditorPaneProps) {
  const currentTabs = () =>
    props.pane === "left" ? tabStore.leftTabs() : tabStore.rightTabs();

  const activeTabId = () =>
    props.pane === "left" ? tabStore.activeTabId() : tabStore.rightActiveTabId();

  const activeTab = () =>
    props.pane === "left"
      ? tabStore.getActiveTab()
      : tabStore.getRightActiveTab();

  const widthStyle = () => {
    if (props.pane === "left") {
      return settingsStore.splitActive()
        ? `${settingsStore.splitWidth()}%`
        : "100%";
    }
    return `${100 - settingsStore.splitWidth()}%`;
  };

  const handleTabClick = (id: string) => {
    tabStore.setActiveTabForPane(id, props.pane);
  };

  const handleTabClose = (id: string) => {
    const result = tabStore.closeTab(id);
    if (props.pane === "left") {
      if (result.paneCleared === "left" && !tabStore.rightTabs().length) {
        settingsStore.setSplitActive(false);
      }
    } else {
      if (result.paneCleared === "right") {
        settingsStore.setSplitActive(false);
      }
    }
  };

  return (
    <div
      class={`flex flex-col overflow-hidden pane-${props.pane}`}
      style={{ width: widthStyle() }}
      onMouseDown={() => tabStore.setFocusedPane(props.pane)}
    >
      <TabBar
        tabs={currentTabs()}
        activeTabId={activeTabId()}
        onTabClick={handleTabClick}
        onTabClose={handleTabClose}
        onTabContextMenu={(id, e) => props.onTabContextMenu(id, props.pane, e)}
      />
      <Editor
        content={activeTab()?.content ?? ""}
        language={activeTab()?.language ?? "text"}
        isDirty={activeTab()?.isDirty ?? false}
        hasOpenFile={!!activeTab()}
        onChange={(content) => {
          const tab = activeTab();
          if (tab) props.handleEditorChange(content, tab.id);
        }}
        tabId={activeTab()?.id ?? null}
        fileType={activeTab()?.fileType ?? "text"}
        dataUrl={activeTab()?.dataUrl}
        fileName={activeTab()?.fileName}
        onCreateFile={() => tabStore.openUntitledTab()}
        onOpenFolder={() => props.fs.openFolder()}
        onOpenCommandPalette={() => {
          props.setPalettePrefix(">");
          props.setShowCommandPalette(true);
        }}
        onSearchWorkspace={() => props.setShowWorkspaceSearch(true)}
      />
    </div>
  );
}
