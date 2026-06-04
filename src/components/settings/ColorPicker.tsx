interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function ColorPicker(props: ColorPickerProps) {
  return (
    <div class="flex items-center gap-3">
      <input
        type="color"
        value={props.value}
        onInput={(e) => props.onChange(e.currentTarget.value)}
        class="w-8 h-8 p-0 border-0 rounded cursor-pointer"
        style={{ background: "transparent" }}
      />
      <span class="text-sm">{props.label}</span>
    </div>
  );
}
