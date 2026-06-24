"use client";

import {
  Tab as AriaTab,
  TabList as AriaTabList,
  type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel,
  type TabPanelProps as AriaTabPanelProps,
  type TabProps as AriaTabProps,
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: AriaTabsProps) {
  return (
    <AriaTabs
      className={composeRenderProps(className, (className) =>
        cn(
          "group flex flex-col gap-2",
          /* Orientation */
          "orientation-vertical:flex-row",
          className,
        ),
      )}
      {...props}
    />
  );
}

const TabList = <T extends object>({
  className,
  ...props
}: AriaTabListProps<T>) => (
  <AriaTabList
    className={composeRenderProps(className, (className) =>
      cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        /* Orientation */
        "orientation-vertical:h-auto orientation-vertical:flex-col",
        className,
      ),
    )}
    {...props}
  />
);

const Tab = ({ className, ...props }: AriaTabProps) => (
  <AriaTab
    className={composeRenderProps(className, (className) =>
      cn(
        "inline-flex cursor-pointer justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm outline-none ring-offset-background transition-all",
        /* Focus Visible */
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        /* Disabled */
        "disabled:pointer-events-none disabled:opacity-50",
        /* Selected */
        "selected:bg-background selected:text-foreground selected:shadow-sm",
        /* Orientation */
        "group-orientation-vertical:w-full",
        className,
      ),
    )}
    {...props}
  />
);

const TabPanel = ({ className, ...props }: AriaTabPanelProps) => (
  <AriaTabPanel
    className={composeRenderProps(className, (className) =>
      cn(
        "mt-2 ring-offset-background",
        /* Focus Visible */
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      ),
    )}
    {...props}
  />
);

export { Tab, TabList, TabPanel, Tabs };
