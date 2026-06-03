import { createSignal, onMount, Show, onCleanup } from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export function IndexerProgress() {
  const [progress, setProgress] = createSignal("");
  const [isIndexing, setIsIndexing] = createSignal(false);

  onMount(async () => {
    let unlistenProgress: UnlistenFn;
    let unlistenDone: UnlistenFn;

    unlistenProgress = await listen<string>("indexing-progress", (e) => {
      setIsIndexing(true);
      setProgress(e.payload);
    });

    unlistenDone = await listen<string>("indexing-done", (e) => {
      setProgress(e.payload);
      setTimeout(() => setIsIndexing(false), 2000);
    });

    onCleanup(() => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenDone) unlistenDone();
    });
  });

  return (
    <Show when={isIndexing()}>
      <div
        class="flex items-center gap-2 h-full px-2 text-[var(--color-fg-muted)] text-[11px] border-r border-[var(--color-border)]"
        style={{ "-webkit-app-region": "no-drag" }}
        title={progress()}
      >
        <svg
          class="animate-spin h-3 w-3 text-[var(--color-accent)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    </Show>
  );
}
