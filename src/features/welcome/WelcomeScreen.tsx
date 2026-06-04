import { tabStore } from "../../stores/tabs";
import { useFileSystem } from "../../hooks/useFileSystem";

interface WelcomeScreenProps {
  onOpenCommandPalette: () => void;
}

export function WelcomeScreen(props: WelcomeScreenProps) {
  const fs = useFileSystem();

  return (
    <div
      class="@container flex-1 flex flex-col items-center justify-center p-4 sm:p-8 @3xl:p-12 overflow-y-auto"
      style={{ background: "var(--color-bg)" }}
    >
      <div class="max-w-[760px] w-full flex flex-col gap-8 @3xl:gap-12 my-auto">
        {/* Header */}
        <div class="flex flex-col items-center text-center">
          <img
            src="/logo.svg"
            alt="Rune Logo"
            class="w-12 h-12 @3xl:w-16 @3xl:h-16 mb-4 select-none pointer-events-none rounded-2xl"
            style={{ "box-shadow": "0 0 20px var(--color-border)" }}
          />
          <h1 class="text-2xl @3xl:text-3xl font-light tracking-[0.3em] uppercase text-[var(--color-fg)]">
            Rune
          </h1>
          <p class="text-xs @3xl:text-sm font-light tracking-wide mt-2 text-[var(--color-fg-muted)]">
            A lightweight, lightning-fast code editor
          </p>
        </div>

        {/* Main Content Grid */}
        <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-6 @3xl:gap-8 items-start">
          {/* Left Column - Actions */}
          <div class="flex flex-col gap-3">
            <h2 class="text-[10px] @3xl:text-xs uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)] mb-1">
              Start
            </h2>
            <button
              class="w-full text-left p-4 rounded-lg transition-all flex items-center gap-4 group cursor-pointer"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-secondary)",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-accent)";
                t.style.background = "var(--color-bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-border)";
                t.style.background = "var(--color-bg-secondary)";
              }}
              onClick={() => tabStore.openUntitledTab()}
            >
              <div
                class="p-2 rounded transition-colors"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="text-sm font-medium text-[var(--color-fg)] transition-colors block truncate"
                  style={{ color: "var(--color-fg)" }}
                >
                  New File
                </span>
                <span class="text-xs text-[var(--color-fg-muted)] mt-0.5 block truncate">
                  Create a new scratchpad file
                </span>
              </div>
              <kbd
                class="ml-auto text-[10px] px-2 py-1 rounded font-mono hidden @sm:block shrink-0"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                Ctrl+N
              </kbd>
            </button>

            <button
              class="w-full text-left p-4 rounded-lg transition-all flex items-center gap-4 group cursor-pointer"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-secondary)",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-accent)";
                t.style.background = "var(--color-bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-border)";
                t.style.background = "var(--color-bg-secondary)";
              }}
              onClick={() => fs.openFolder()}
            >
              <div
                class="p-2 rounded transition-colors"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors"
                >
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="text-sm font-medium text-[var(--color-fg)] transition-colors block truncate"
                  style={{ color: "var(--color-fg)" }}
                >
                  Open Folder
                </span>
                <span class="text-xs text-[var(--color-fg-muted)] mt-0.5 block truncate">
                  Open an existing workspace
                </span>
              </div>
              <kbd
                class="ml-auto text-[10px] px-2 py-1 rounded font-mono hidden @sm:block shrink-0"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                Ctrl+K Ctrl+O
              </kbd>
            </button>

            <button
              class="w-full text-left p-4 rounded-lg transition-all flex items-center gap-4 group cursor-pointer"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-secondary)",
              }}
              onMouseEnter={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-accent)";
                t.style.background = "var(--color-bg-tertiary)";
              }}
              onMouseLeave={(e) => {
                const t = e.currentTarget as HTMLElement;
                t.style.borderColor = "var(--color-border)";
                t.style.background = "var(--color-bg-secondary)";
              }}
              onClick={props.onOpenCommandPalette}
            >
              <div
                class="p-2 rounded transition-colors"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)] transition-colors"
                >
                  <polyline points="4 17 10 11 4 5" />
                  <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
              </div>
              <div class="min-w-0 flex-1">
                <span
                  class="text-sm font-medium text-[var(--color-fg)] transition-colors block truncate"
                  style={{ color: "var(--color-fg)" }}
                >
                  Command Palette
                </span>
                <span class="text-xs text-[var(--color-fg-muted)] mt-0.5 block truncate">
                  Run commands and search tools
                </span>
              </div>
              <kbd
                class="ml-auto text-[10px] px-2 py-1 rounded font-mono hidden @sm:block shrink-0"
                style={{
                  background: "var(--color-bg)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-fg-muted)",
                }}
              >
                Ctrl+Shift+P
              </kbd>
            </button>
          </div>

          {/* Right Column - Shortcuts */}
          <div class="flex flex-col gap-3">
            <h2 class="text-[10px] @3xl:text-xs uppercase tracking-[0.2em] font-semibold text-[var(--color-fg-muted)] mb-1">
              Keyboard Shortcuts
            </h2>
            <div
              class="rounded-lg p-5 flex flex-col gap-4"
              style={{
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-secondary)",
              }}
            >
              <div
                class="flex justify-between items-center text-xs pb-2"
                style={{
                  "border-bottom": "1px solid var(--color-border)",
                }}
              >
                <span class="truncate mr-2 min-w-0 flex-1" style={{ color: "var(--color-fg-muted)" }}>
                  New Window
                </span>
                <kbd
                  class="px-2 py-0.5 rounded font-mono shrink-0 hidden @sm:block"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                >
                  Ctrl+Shift+N
                </kbd>
              </div>
              <div
                class="flex justify-between items-center text-xs pb-2"
                style={{
                  "border-bottom": "1px solid var(--color-border)",
                }}
              >
                <span class="truncate mr-2 min-w-0 flex-1" style={{ color: "var(--color-fg-muted)" }}>
                  Save Document
                </span>
                <kbd
                  class="px-2 py-0.5 rounded font-mono shrink-0 hidden @sm:block"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                >
                  Ctrl+S
                </kbd>
              </div>
              <div
                class="flex justify-between items-center text-xs pb-2"
                style={{
                  "border-bottom": "1px solid var(--color-border)",
                }}
              >
                <span class="truncate mr-2 min-w-0 flex-1" style={{ color: "var(--color-fg-muted)" }}>
                  Find in Workspace
                </span>
                <kbd
                  class="px-2 py-0.5 rounded font-mono shrink-0 hidden @sm:block"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                >
                  Ctrl+Shift+F
                </kbd>
              </div>
              <div
                class="flex justify-between items-center text-xs pb-2"
                style={{
                  "border-bottom": "1px solid var(--color-border)",
                }}
              >
                <span class="truncate mr-2 min-w-0 flex-1" style={{ color: "var(--color-fg-muted)" }}>
                  Toggle Sidebar
                </span>
                <kbd
                  class="px-2 py-0.5 rounded font-mono shrink-0 hidden @sm:block"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                >
                  Ctrl+B
                </kbd>
              </div>
              <div class="flex justify-between items-center text-xs">
                <span class="truncate mr-2 min-w-0 flex-1" style={{ color: "var(--color-fg-muted)" }}>
                  Zoom In / Out
                </span>
                <kbd
                  class="px-2 py-0.5 rounded font-mono shrink-0 hidden @sm:block"
                  style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                >
                  Ctrl + / -
                </kbd>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
