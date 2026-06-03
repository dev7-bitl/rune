import { Show, createSignal } from "solid-js";
import { CodeMirrorView } from "./CodeMirrorView";
import { ImageViewer } from "./ImageViewer";
import { PdfViewer } from "./PdfViewer";
import { MarkdownPreview } from "./MarkdownPreview";
import { SettingsView } from "../../components/SettingsView";
import { WelcomeScreen } from "../welcome/WelcomeScreen";
import type { FileType } from "../../types";

interface EditorProps {
  content: string;
  language: string;
  isDirty: boolean;
  onChange?: (content: string) => void;
  hasOpenFile: boolean;
  tabId: string | null;
  fileType: FileType;
  dataUrl?: string;
  fileName?: string;
  onCreateFile?: () => void;
  onOpenFolder?: () => void;
  onOpenCommandPalette?: () => void;
  onSearchWorkspace?: () => void;
}

type MdMode = "edit" | "preview" | "split";

export function Editor(props: EditorProps) {
  const [mdMode, setMdMode] = createSignal<MdMode>("edit");
  const [editorScroller, setEditorScroller] = createSignal<HTMLElement | null>(
    null,
  );

  return (
    <div class="flex-1 h-full overflow-hidden flex flex-col">
      <Show when={props.hasOpenFile && props.fileType === "markdown"}>
        <div
          class="flex items-center gap-1 px-2 h-[28px] shrink-0"
          style={{
            "border-bottom": "1px solid var(--color-border)",
            background: "var(--color-bg-secondary)",
          }}
        >
          {(["edit", "preview", "split"] as MdMode[]).map((mode) => (
            <button
              class="px-2 py-0.5 text-[11px] uppercase tracking-wide transition-colors"
              style={{
                color:
                  mdMode() === mode
                    ? "var(--color-accent)"
                    : "var(--color-fg-muted)",
                background:
                  mdMode() === mode
                    ? "var(--color-bg-tertiary)"
                    : "transparent",
                border: "none",
                cursor: "pointer",
              }}
              onClick={() => setMdMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </Show>

      <div class="flex-1 overflow-hidden">
        <Show when={!props.hasOpenFile}>
          <div class="h-full">
            <WelcomeScreen onOpenCommandPalette={props.onOpenCommandPalette!} />
          </div>
        </Show>

        <Show
          when={
            props.hasOpenFile && props.fileType === "image" && props.dataUrl
          }
        >
          <ImageViewer
            dataUrl={props.dataUrl!}
            fileName={props.fileName ?? ""}
          />
        </Show>

        <Show
          when={props.hasOpenFile && props.fileType === "pdf" && props.dataUrl}
        >
          <PdfViewer dataUrl={props.dataUrl!} fileName={props.fileName ?? ""} />
        </Show>

        <Show
          when={props.hasOpenFile && props.fileType === "text" && props.tabId}
        >
          <CodeMirrorView
            tabId={props.tabId}
            content={props.content}
            language={props.language}
            onChange={props.onChange}
          />
        </Show>

        <Show
          when={
            props.hasOpenFile && props.fileType === "markdown" && props.tabId
          }
        >
          <div class="flex h-full">
            <Show when={mdMode() === "edit" || mdMode() === "split"}>
              <div
                class={mdMode() === "split" ? "w-1/2" : "w-full"}
                style={{
                  "border-right":
                    mdMode() === "split"
                      ? "1px solid var(--color-border)"
                      : "none",
                }}
              >
                <CodeMirrorView
                  tabId={props.tabId}
                  content={props.content}
                  language="markdown"
                  onChange={props.onChange}
                  onScrollerRef={
                    mdMode() === "split" ? setEditorScroller : undefined
                  }
                />
              </div>
            </Show>
            <Show when={mdMode() === "preview" || mdMode() === "split"}>
              <div class={mdMode() === "split" ? "w-1/2" : "w-full"}>
                <MarkdownPreview
                  content={props.content}
                  editorScrollElement={
                    mdMode() === "split" ? editorScroller() : undefined
                  }
                />
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.hasOpenFile && props.fileType === "settings"}>
          <SettingsView />
        </Show>
      </div>
    </div>
  );
}
