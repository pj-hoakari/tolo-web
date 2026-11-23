"use client";

import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuHeader,
  MenuItem,
  MenuPopover,
  MenuSection,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

export type HeaderMenuItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sub?: string;
  run: () => void;
  disabled?: boolean;
  /** この項目から新しいまとまりにする（文字があれば見出しも出す） */
  group?: string;
};

// 上の帯のメニュー（「ファイル」「その他」）。押すと下に項目が並び、選ぶと閉じる
export function HeaderMenu({
  label,
  icon: Icon,
  items,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: HeaderMenuItem[];
}) {
  // group の付いた項目で区切って、まとまり（見出し付き）に分ける
  const sections: { title: string; items: HeaderMenuItem[] }[] = [];
  for (const item of items) {
    if (sections.length === 0 || item.group !== undefined)
      sections.push({ title: item.group ?? "", items: [] });
    sections[sections.length - 1].items.push(item);
  }
  return (
    <MenuTrigger>
      <Button
        variant="outline"
        aria-label={label}
        className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
      >
        <Icon className="size-4" />
        <span className="hidden min-[1200px]:inline">{label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </Button>
      <MenuPopover placement="bottom end">
        <Menu
          aria-label={label}
          className="w-72"
          disabledKeys={items.filter((m) => m.disabled).map((m) => m.id)}
          onAction={(key) => items.find((m) => m.id === key)?.run()}
        >
          {sections.map((section, i) => [
            i > 0 && <MenuSeparator key={`separator-${section.items[0].id}`} />,
            <MenuSection key={`section-${section.items[0].id}`}>
              {section.title && (
                <MenuHeader
                  separator={false}
                  className="px-2 pt-1 pb-0.5 font-mono text-[10px] font-normal tracking-[0.12em] text-muted-foreground"
                >
                  {section.title}
                </MenuHeader>
              )}
              {section.items.map((m) => (
                <MenuItem
                  key={m.id}
                  id={m.id}
                  textValue={m.label}
                  className="items-start gap-2.5 py-2 text-xs"
                >
                  <m.icon className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-medium">{m.label}</span>
                    {m.sub && (
                      <span className="block text-muted-foreground">
                        {m.sub}
                      </span>
                    )}
                  </span>
                </MenuItem>
              ))}
            </MenuSection>,
          ])}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
