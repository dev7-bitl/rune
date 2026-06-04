import { For, Show } from "solid-js";
import type { Tab as TabType } from "../../types";
import { Tab } from "./Tab";
import { tabStore } from "../../stores/tabs";

interface TabBarProps {
  tabs: TabType[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabContextMenu: (tabId: string, e: MouseEvent) => void;
}

export function TabBar(props: TabBarProps) {
  return (
    <Show when={props.tabs.length > 0}>
      <div
        ref={(el) => {
          el.addEventListener(
            "wheel",
            (e) => {
              if (e.deltaY !== 0) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
              }
            },
            { passive: false },
          );
        }}
        class="flex items-end h-[32px] shrink-0 overflow-x-auto"
        style={{
          background: "var(--color-tab-bg)",
          "border-bottom": "1px solid var(--color-border)",
          "scrollbar-width": "none",
        }}
        onDragEnter={(e) => e.preventDefault()}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sourceTabId = e.dataTransfer?.getData("application/rune-tab");
          if (sourceTabId) {
            // Drop on the container means move to the end of this pane
            // We can determine the pane by looking at the last tab in this tabbar
            const lastTab = props.tabs[props.tabs.length - 1];
            if (lastTab && lastTab.id !== sourceTabId) {
              // We'll just reorder it to the position of the last tab, but actually we want it AFTER the last tab.
              // Wait, reorderTabs just inserts it at the target index. If we target the last tab, it goes before/at the last tab.
              // To make it go at the very end, we can pass a special flag or just do it in tabStore.
              // For simplicity, dropping on the container can just move it to the last tab's position.
              tabStore.reorderTabs(sourceTabId, lastTab.id);
            }
          }
        }}
      >
        <For each={props.tabs}>
          {(tab) => (
            <Tab
              tab={tab}
              isActive={props.activeTabId === tab.id}
              onClick={() => props.onTabClick(tab.id)}
              onClose={(e) => {
                e.stopPropagation();
                props.onTabClose(tab.id);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                props.onTabContextMenu(tab.id, e);
              }}
              onDragDrop={(sourceId, targetId) => {
                tabStore.reorderTabs(sourceId, targetId);
              }}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
