import { onMount, onCleanup, createEffect, createSignal, Show } from "solid-js";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLineGutter,
  highlightActiveLine,
  drawSelection,
  rectangularSelection,
  highlightSpecialChars,
  crosshairCursor,
} from "@codemirror/view";
import { globalSettings } from "../../stores/settings";
import { EditorState, Compartment, Transaction } from "@codemirror/state";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
  selectAll,
} from "@codemirror/commands";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { invoke } from "@tauri-apps/api/core";
import { searchKeymap, highlightSelectionMatches, openSearchPanel } from "@codemirror/search";
import {
  foldGutter,
  indentOnInput,
  bracketMatching,
  foldKeymap,
  syntaxHighlighting,
  defaultHighlightStyle,
} from "@codemirror/language";
import {
  ContextMenu,
  type ContextMenuItem,
} from "../../components/ContextMenu";
import { pluginRegistry } from "../../plugins";
import { tabStore } from "../../stores/tabs";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import { markdown } from "@codemirror/lang-markdown";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { php } from "@codemirror/lang-php";
import { xml } from "@codemirror/lang-xml";
import { vue } from "@codemirror/lang-vue";
import { StreamLanguage } from "@codemirror/language";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { yaml } from "@codemirror/legacy-modes/mode/yaml";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { go } from "@codemirror/legacy-modes/mode/go";
import { createRuneTheme } from "./cmTheme";
import type { Extension } from "@codemirror/state";

function getLanguageExtension(lang: string): Extension {
  switch (lang) {
    case "javascript":
      return javascript({ jsx: true });
    case "typescript":
      return javascript({ typescript: true, jsx: true });
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "rust":
      return rust();
    case "python":
      return python();
    case "markdown":
      return markdown();
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "sql":
      return sql();
    case "php":
      return php();
    case "xml":
      return xml();
    case "vue":
      return vue();
    case "toml":
      return StreamLanguage.define(toml);
    case "yaml":
      return StreamLanguage.define(yaml);
    case "shell":
      return StreamLanguage.define(shell);
    case "go":
      return StreamLanguage.define(go);
    case "blade":
      return html(); // Blade = HTML + @directives + {{ }}
    default:
      return [];
  }
}

interface CodeMirrorViewProps {
  content: string;
  language: string;
  onChange?: (content: string) => void;
  onScrollerRef?: (el: HTMLElement | null) => void;
  tabId?: string | null;
}

async function globalWordCompletion(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const word = context.matchBefore(/[\w_]+/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  try {
    const completions: string[] = await invoke("get_completions", {
      query: word.text,
    });
    if (completions.length === 0) return null;

    return {
      from: word.from,
      options: completions.map((c) => ({
        label: c,
        type: "text",
        boost: -1,
      })),
    };
  } catch (e) {
    return null;
  }
}

const editorStateCache = new Map<string, EditorState>();
const languageCompartment = new Compartment();
const wordWrapCompartment = new Compartment();
const updateListenerCompartment = new Compartment();

export function CodeMirrorView(props: CodeMirrorViewProps) {
  let containerRef!: HTMLDivElement;
  let view: EditorView | undefined;
  let currentContent = props.content;
  let settingContent = false;
  let lastTabId = props.tabId;
  const [ctxMenu, setCtxMenu] = createSignal<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  let gotoLineHandler: ((e: Event) => void) | undefined;
  let findHandler: ((e: Event) => void) | undefined;

  let updateIndexTimeout: number | undefined;
  onCleanup(() => {
    if (updateIndexTimeout) clearTimeout(updateIndexTimeout);
  });

  function scheduleIndexUpdate(content: string) {
    if (!props.tabId) return;
    const tab = tabStore.tabs().find((t) => t.id === props.tabId);
    if (!tab?.filePath) return;

    if (updateIndexTimeout) clearTimeout(updateIndexTimeout);
    updateIndexTimeout = window.setTimeout(() => {
      invoke("update_file_index", { filePath: tab.filePath, content }).catch(
        console.error,
      );
    }, 1000);
  }

  function getUpdateListener() {
    return EditorView.updateListener.of((update) => {
      if (props.tabId) {
        editorStateCache.set(props.tabId, update.state);
      }
      if (update.docChanged && !settingContent) {
        const isUserEdit = update.transactions.some(
          (t) => t.annotation(Transaction.userEvent) !== undefined,
        );
        if (isUserEdit) {
          currentContent = update.state.doc.toString();
          props.onChange?.(currentContent);
          scheduleIndexUpdate(currentContent);
        }
      }
    });
  }

  function buildExtensions(): Extension[] {
    return [
      EditorState.allowMultipleSelections.of(true),
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      foldGutter(),
      drawSelection(),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      EditorState.languageData.of(() => [
        { autocomplete: globalWordCompletion },
      ]),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightSelectionMatches({ minSelectionLength: 1 }),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      keymap.of([
        { key: "Mod-Shift-z", run: redo, preventDefault: true },
        {
          key: "F12",
          run: (targetView) => {
            const state = targetView.state;
            const pos = state.selection.main.head;
            const word = state.wordAt(pos);
            if (!word) return false;

            const wordStr = state.sliceDoc(word.from, word.to);
            invoke<{ path: string; line: number } | null>("get_definition", {
              symbol: wordStr,
            }).then((sym) => {
              if (sym) {
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
              }
            });
            return true;
          },
        },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
      ]),
      languageCompartment.of(getLanguageExtension(props.language)),
      wordWrapCompartment.of(
        globalSettings.wordWrap ? EditorView.lineWrapping : [],
      ),
      updateListenerCompartment.of(getUpdateListener()),
      createRuneTheme(),
    ];
  }

  onMount(() => {
    let state: EditorState;
    const cached = props.tabId ? editorStateCache.get(props.tabId) : undefined;
    if (cached) {
      if (cached.doc.toString() === props.content) {
        state = cached;
      } else {
        state = EditorState.create({
          doc: props.content,
          extensions: buildExtensions(),
        });
      }
    } else {
      state = EditorState.create({
        doc: props.content,
        extensions: buildExtensions(),
      });
    }

    view = new EditorView({ state, parent: containerRef });
    
    // Always reconfigure the update listener immediately to ensure it closes over the current component's props
    if (cached) {
      view.dispatch({
        effects: updateListenerCompartment.reconfigure(getUpdateListener())
      });
    }

    view.focus();
    props.onScrollerRef?.(view.scrollDOM);

    gotoLineHandler = (e: Event) => {
      const { path, line } = (e as CustomEvent).detail;
      const tab = tabStore.tabs().find((t) => t.id === props.tabId);
      if (tab?.filePath === path && view) {
        const doc = view.state.doc;
        if (line >= 1 && line <= doc.lines) {
          const lineInfo = doc.line(line);
          view.dispatch({
            selection: { anchor: lineInfo.from },
            effects: EditorView.scrollIntoView(lineInfo.from, { y: "center" }),
          });
          view.focus();
        }
      }
    };
    window.addEventListener("rune-goto-line-path", gotoLineHandler);

    findHandler = () => {
      // Only respond if this editor's tab is currently focused
      if (tabStore.activeTabId() === props.tabId || tabStore.rightActiveTabId() === props.tabId) {
        if (view) {
          openSearchPanel(view);
          view.focus();
        }
      }
    };
    window.addEventListener("rune-editor-find", findHandler);
  });

  onCleanup(() => {
    if (gotoLineHandler) {
      window.removeEventListener("rune-goto-line-path", gotoLineHandler);
    }
    if (findHandler) {
      window.removeEventListener("rune-editor-find", findHandler);
    }
    if (view && props.tabId) {
      editorStateCache.set(props.tabId, view.state);
    }
    view?.destroy();
    view = undefined;
  });

  createEffect(() => {
    const lang = props.language;
    if (view && languageCompartment.get(view.state)) {
      view.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(lang)),
      });
    }
  });

  createEffect(() => {
    if (view) {
      view.dispatch({
        effects: wordWrapCompartment.reconfigure(
          globalSettings.wordWrap ? EditorView.lineWrapping : [],
        ),
      });
    }
  });

  createEffect(() => {
    const newContent = props.content;
    const tabId = props.tabId;
    if (!view) return;
    if (currentContent === newContent && tabId === lastTabId) return;

    // Tab switched
    if (tabId !== lastTabId) {
      if (lastTabId && view) {
        editorStateCache.set(lastTabId, view.state);
      }
      
      lastTabId = tabId;
      currentContent = newContent;
      
      const cached = tabId ? editorStateCache.get(tabId) : undefined;
      let state: EditorState;
      if (cached) {
        if (cached.doc.toString() === newContent) {
          state = cached;
        } else {
          state = EditorState.create({
            doc: newContent,
            extensions: buildExtensions(),
          });
        }
      } else {
        state = EditorState.create({
          doc: newContent,
          extensions: buildExtensions(),
        });
      }
      view.setState(state);
      
      // If we loaded from cache, ensure we swap the updateListener to the current component's scope
      if (cached) {
        view.dispatch({
          effects: updateListenerCompartment.reconfigure(getUpdateListener())
        });
      }
      return;
    }

    // Same tab, content changed externally
    currentContent = newContent;
    settingContent = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: newContent },
    });
    settingContent = false;
  });

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!view) return;

    const items: ContextMenuItem[] = [
      {
        label: "Cut",
        action: () => {
          if (!view) return;
          const state = view.state;
          const text = state.sliceDoc(state.selection.main.from, state.selection.main.to);
          if (text) {
            navigator.clipboard.writeText(text).then(() => {
              if (view) view.dispatch(view.state.replaceSelection(""));
            });
          }
        },
      },
      {
        label: "Copy",
        action: () => {
          if (!view) return;
          const state = view.state;
          const text = state.sliceDoc(state.selection.main.from, state.selection.main.to);
          if (text) {
            navigator.clipboard.writeText(text);
          }
        },
      },
      {
        label: "Paste",
        action: () => {
          view?.focus();
          if (!view) return;
          navigator.clipboard
            .readText()
            .then((text) => {
              if (!view) return;
              view.dispatch(view.state.replaceSelection(text));
            })
            .catch(() => {
              document.execCommand("paste");
            });
        },
      },
      { separator: true, label: "" },
      {
        label: "Select All",
        action: () => {
          view?.focus();
          if (view) selectAll(view);
        },
      },
      { separator: true, label: "" },
      {
        label: "Undo",
        action: () => {
          view?.focus();
          undo(view!);
        },
      },
      {
        label: "Redo",
        action: () => {
          view?.focus();
          redo(view!);
        },
      },
    ];

    // Plugin context menu items
    const activeTab = tabStore.getFocusedTab();
    const pluginItems = pluginRegistry.getContextMenuItems("editor", {
      language: activeTab?.language,
      filePath: activeTab?.filePath,
    });
    if (pluginItems.length > 0) {
      items.push({ separator: true, label: "" });
      for (const p of pluginItems) {
        if ("separator" in p && p.separator) {
          items.push({ separator: true, label: "" });
        } else {
          const reg = p as any;
          items.push({
            label: reg.label,
            icon: reg.icon,
            hint: reg.hint,
            action: () =>
              reg.action({
                language: activeTab?.language,
                filePath: activeTab?.filePath,
              }),
          });
        }
      }
    }

    setCtxMenu({ x: e.clientX, y: e.clientY, items });
  }

  return (
    <>
      <div
        ref={containerRef}
        class="h-full w-full overflow-hidden"
        onContextMenu={handleContextMenu}
      />
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
    </>
  );
}
