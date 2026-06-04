import { Show } from "solid-js";
import type { JSX } from "solid-js";

interface SettingRowProps {
  label: string;
  description?: string;
  children: JSX.Element;
}

export function SettingRow(props: SettingRowProps) {
  return (
    <div class="flex items-center justify-between py-4 border-b border-[var(--color-border)]">
      <div class="flex flex-col pr-8">
        <span class="font-medium text-sm">{props.label}</span>
        <Show when={props.description}>
          <span class="text-xs text-[var(--color-fg-muted)] mt-1">
            {props.description}
          </span>
        </Show>
      </div>
      <div class="w-64 shrink-0 flex items-center justify-end">
        {props.children}
      </div>
    </div>
  );
}
