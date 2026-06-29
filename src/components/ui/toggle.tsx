"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  ToggleButton as AriaToggleButton,
  ToggleButtonGroup as AriaToggleButtonGroup,
  type ToggleButtonGroupProps as AriaToggleButtonGroupProps,
  type ToggleButtonProps as AriaToggleButtonProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  [
    "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors",
    /* Disabled */
    "disabled:pointer-events-none disabled:opacity-50",
    /* Hover */
    "hover:bg-muted hover:text-muted-foreground",
    /* Selected */
    "selected:bg-accent selected:text-accent-foreground",
    /* Focus Visible */
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  ],
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-3",
        sm: "h-9 px-2.5",
        lg: "h-11 px-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

interface ToggleProps
  extends AriaToggleButtonProps,
    VariantProps<typeof toggleVariants> {}

const Toggle = ({ className, variant, size, ...props }: ToggleProps) => (
  <AriaToggleButton
    className={composeRenderProps(className, (className) =>
      cn(
        "group-orientation-vertical/togglegroup:w-full",
        toggleVariants({
          variant,
          size,
          className,
        }),
      ),
    )}
    {...props}
  />
);

const ToggleButtonGroup = ({
  children,
  className,
  ...props
}: AriaToggleButtonGroupProps) => (
  <AriaToggleButtonGroup
    className={composeRenderProps(className, (className) =>
      cn(
        "group/togglegroup flex orientation-vertical:flex-col items-center justify-center gap-1",
        className,
      ),
    )}
    {...props}
  >
    {children}
  </AriaToggleButtonGroup>
);

export type { ToggleProps };
export { Toggle, ToggleButtonGroup, toggleVariants };
