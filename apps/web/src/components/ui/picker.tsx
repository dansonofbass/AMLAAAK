"use client";
import { useId, useState, useEffect } from "react";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useLanguage } from "../language";
type Option = { value: string; label: string };
type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  label: string;
  name?: string;
  disabled?: boolean;
  searchable?: boolean;
  placeholder?: string;
};
export function Picker({
  value,
  onChange,
  options,
  label,
  name,
  disabled = false,
  searchable = false,
  placeholder = "Choose…",
}: Props) {
  const { t, rtl } = useLanguage();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(0);
  const id = useId();
  useEffect(() => {
    if (open && searchable)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, open, searchable, id]);
  const selected = options.find((o) => o.value === value)?.label || placeholder;
  if (searchable) {
    const filtered = options.filter(
      (o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.includes(search.toLowerCase()),
    );
    const choose = (v: string) => {
      onChange(v);
      setOpen(false);
      setSearch("");
      setActive(0);
    };
    return (
      <>
        <input type="hidden" name={name} value={value} />
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="picker-trigger"
              role="combobox"
              aria-label={label}
              aria-expanded={open}
              aria-controls={id}
              disabled={disabled}
            >
              <span>{selected}</span>
              <ChevronDown size={13} />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              className="picker-popup"
              align="start"
              sideOffset={7}
              collisionPadding={12}
              dir={rtl ? "rtl" : "ltr"}
            >
              <label className="picker-search">
                <Search size={14} />
                <input
                  autoComplete="off"
                  aria-label={t(
                    `Search ${label.toLowerCase()}`,
                    `جستجوی ${label}`,
                  )}
                  aria-controls={id}
                  aria-activedescendant={
                    filtered[active] ? `${id}-${active}` : undefined
                  }
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActive(0);
                  }}
                  placeholder={t("Search by name…", "جستجو با نام…")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((v) => Math.min(filtered.length - 1, v + 1));
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((v) => Math.max(0, v - 1));
                    }
                    if (e.key === "Enter" && filtered[active]) {
                      e.preventDefault();
                      choose(filtered[active].value);
                    }
                  }}
                />
              </label>
              <div
                role="listbox"
                id={id}
                aria-label={label}
                className="picker-options"
              >
                {filtered.length ? (
                  filtered.map((option, i) => (
                    <button
                      id={`${id}-${i}`}
                      type="button"
                      role="option"
                      aria-selected={value === option.value}
                      tabIndex={-1}
                      key={option.value}
                      data-active={active === i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(option.value)}
                    >
                      <span>{option.label}</span>
                      {value === option.value && <Check size={13} />}
                    </button>
                  ))
                ) : (
                  <p className="picker-empty">
                    {t(
                      "No options in retrieved records",
                      "گزینه‌ای در داده‌های دریافت‌شده یافت نشد",
                    )}
                  </p>
                )}
              </div>
              <span className="picker-help">
                {t(
                  "↑ ↓ to navigate · Enter to select · Esc to close",
                  "کلیدهای جهت برای حرکت · Enter برای انتخاب · Esc برای بستن",
                )}
              </span>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </>
    );
  }
  return (
    <Select.Root
      dir={rtl ? "rtl" : "ltr"}
      value={value || "__all__"}
      onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
      name={name}
      disabled={disabled}
    >
      <Select.Trigger className="picker-trigger" aria-label={label}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown size={13} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          align="start"
          sideOffset={7}
          className="picker-popup"
        >
          <Select.Viewport className="picker-options">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value || "__all__"}
                className="picker-item"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check size={13} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
