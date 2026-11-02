"use client";

import { RotateCcw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectListBox,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input, TextField } from "@/components/ui/textfield";
import { cn } from "@/lib/utils";

export function ListFilters<T extends string>({
  query,
  onQueryChange,
  searchLabel,
  filterLabel,
  selected,
  onSelectionChange,
  options,
  onReset,
  resetLabel,
  isResetDisabled,
  compact = false,
  additionalFilters,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  searchLabel: string;
  filterLabel: string;
  selected: T;
  onSelectionChange: (value: T) => void;
  options: { id: T; label: string }[];
  onReset: () => void;
  resetLabel: string;
  isResetDisabled: boolean;
  compact?: boolean;
  additionalFilters?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        !compact && "lg:grid-cols-[minmax(0,1fr)_10rem_auto_auto]",
      )}
    >
      <TextField
        type="search"
        value={query}
        onChange={onQueryChange}
        className="min-w-0"
      >
        <Label className="sr-only">{searchLabel}</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input placeholder={searchLabel} className="h-10 pl-10" />
        </div>
      </TextField>
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-4",
          !compact && "lg:contents",
        )}
      >
        <Select
          selectedKey={selected}
          onSelectionChange={(key) => {
            const option = options.find((item) => item.id === key);
            if (option) onSelectionChange(option.id);
          }}
          className="group min-w-0 flex-1 basis-40"
        >
          <Label className="sr-only">{filterLabel}</Label>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectPopover>
            <SelectListBox items={options}>
              {(option) => (
                <SelectItem id={option.id}>{option.label}</SelectItem>
              )}
            </SelectListBox>
          </SelectPopover>
        </Select>
        {additionalFilters && (
          <div className="order-last w-full lg:order-none lg:w-auto">
            {additionalFilters}
          </div>
        )}
        <Button
          variant="outline"
          onPress={onReset}
          isDisabled={isResetDisabled}
          className="h-10 gap-2 px-3 sm:px-4"
          aria-label={resetLabel}
        >
          <RotateCcw aria-hidden className="size-4" />
          <span className="hidden sm:inline">{resetLabel}</span>
        </Button>
      </div>
    </div>
  );
}
