import { createSignal, onCleanup, For, Show } from "solid-js";

interface CustomSelectProps {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  width?: string;
}

export function CustomSelect(props: CustomSelectProps) {
  const [isOpen, setIsOpen] = createSignal(false);
  let containerRef!: HTMLDivElement;

  const handleClickOutside = (e: MouseEvent) => {
    if (isOpen() && containerRef && !containerRef.contains(e.target as Node)) {
      setIsOpen(false);
    }
  };

  window.addEventListener("click", handleClickOutside);
  onCleanup(() => window.removeEventListener("click", handleClickOutside));

  const selectedLabel = () =>
    props.options.find((o) => o.value === props.value)?.label || props.value;

  return (
    <div
      ref={containerRef}
      class="relative"
      style={{ width: props.width || "200px" }}
    >
      <div
        class="flex items-center justify-between px-3 py-1.5 rounded-md border cursor-pointer select-none text-sm transition-colors"
        style={{
          background: "var(--color-bg-secondary)",
          color: "var(--color-fg)",
          "border-color": isOpen()
            ? "var(--color-accent)"
            : "var(--color-border)",
        }}
        onClick={() => setIsOpen(!isOpen())}
      >
        <span class="truncate">{selectedLabel()}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class={`transition-transform ${isOpen() ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      <Show when={isOpen()}>
        <div
          class="absolute z-50 mt-1 w-full rounded-md border shadow-lg overflow-hidden flex flex-col max-h-60 overflow-y-auto"
          style={{
            background: "var(--color-bg-secondary)",
            "border-color": "var(--color-border)",
          }}
        >
          <For each={props.options}>
            {(opt) => (
              <div
                class="px-3 py-1.5 text-sm cursor-pointer select-none"
                style={{
                  color:
                    props.value === opt.value
                      ? "var(--color-accent)"
                      : "var(--color-fg)",
                  "background-color":
                    props.value === opt.value
                      ? "var(--color-bg-tertiary)"
                      : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (props.value !== opt.value) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "var(--color-accent)";
                    (e.currentTarget as HTMLElement).style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (props.value !== opt.value) {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--color-fg)";
                  }
                }}
                onClick={() => {
                  props.onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
