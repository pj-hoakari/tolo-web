"use client";

import { ChevronRightIcon, InfoIcon } from "lucide-react";
import {
  Tree as AriaTree,
  TreeHeader as AriaTreeHeader,
  TreeItem as AriaTreeItem,
  TreeItemContent as AriaTreeItemContent,
  type TreeItemProps as AriaTreeItemProps,
  type TreeProps as AriaTreeProps,
  TreeSection as AriaTreeSection,
  Button,
  type ButtonProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

const TreeItemContent = AriaTreeItemContent;

const TreeSection = AriaTreeSection;

function Tree<T extends object>({ className, ...props }: AriaTreeProps<T>) {
  return (
    <AriaTree
      className={composeRenderProps(className, (className) =>
        cn("flex flex-col gap-1 overflow-auto p-1 outline-none", className),
      )}
      {...props}
    />
  );
}

function TreeHeader({
  className,
  ...props
}: React.ComponentProps<typeof AriaTreeHeader>) {
  return (
    <AriaTreeHeader
      className={cn("p-1 text-sm font-semibold", className)}
      {...props}
    />
  );
}

function TreeItemExpandButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      slot="chevron"
      className={composeRenderProps(className, (className) =>
        cn("outline-none", className),
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          <ChevronRightIcon className="group-expanded:rotate-90 size-4 shrink-0 transition-transform duration-200" />
          {children}
        </>
      ))}
    </Button>
  );
}

function TreeItemInfoButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      aria-label="Info"
      className={composeRenderProps(className, (className) =>
        cn(
          "ml-auto flex items-center justify-center rounded-md ring-offset-background",
          /* Disabled */
          "disabled:pointer-events-none disabled:opacity-50",
          /* Focus Visible */
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        ),
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          {children}
          <InfoIcon className="size-4 shrink-0" />
        </>
      ))}
    </Button>
  );
}

function TreeItem<T extends object>({
  className,
  ...props
}: AriaTreeItemProps<T>) {
  return (
    <AriaTreeItem
      className={composeRenderProps(className, (className) =>
        cn(
          "group has-child-items:pl-[calc((var(--tree-item-level)_-_1)_*_1.5rem)] relative flex items-center gap-2 rounded-md p-1 pl-[calc((var(--tree-item-level)_-_1)_*_2.25rem)] font-medium ring-offset-background outline-none",
          /* Disabled */
          "disabled:pointer-events-none disabled:opacity-50",
          /* Focus Visible */
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none",
          className,
        ),
      )}
      {...props}
    />
  );
}

export {
  Tree,
  TreeHeader,
  TreeItem,
  TreeItemContent,
  TreeItemExpandButton,
  TreeItemInfoButton,
  TreeSection,
};
