"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  type DialogProps as AriaDialogProps,
  DialogTrigger as AriaDialogTrigger,
  Heading as AriaHeading,
  type HeadingProps as AriaHeadingProps,
  Modal as AriaModal,
  ModalOverlay as AriaModalOverlay,
  type ModalOverlayProps as AriaModalOverlayProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

const Dialog = AriaDialog;

const sheetVariants = cva(
  [
    "fixed z-50 gap-4 bg-background shadow-lg transition ease-in-out",
    /* Entering */
    "entering:duration-500 entering:animate-in",
    /* Exiting */
    "exiting:duration-300 exiting:animate-out",
  ],
  {
    variants: {
      side: {
        top: "entering:slide-in-from-top exiting:slide-out-to-top inset-x-0 top-0 border-b",
        bottom:
          "entering:slide-in-from-bottom exiting:slide-out-to-bottom inset-x-0 bottom-0 border-t",
        left: "entering:slide-in-from-left exiting:slide-out-to-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
        right:
          "entering:slide-in-from-right exiting:slide-out-to-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
      },
    },
  },
);

const DialogTrigger = AriaDialogTrigger;

const DialogOverlay = ({
  className,
  isDismissable = true,
  ...props
}: AriaModalOverlayProps) => (
  <AriaModalOverlay
    isDismissable={isDismissable}
    className={composeRenderProps(className, (className) =>
      cn(
        "fixed inset-0 z-50 bg-black/80",
        /* Exiting */
        "exiting:fade-out-0 exiting:animate-out exiting:duration-300",
        /* Entering */
        "entering:fade-in-0 entering:animate-in",
        className,
      ),
    )}
    {...props}
  />
);

interface DialogContentProps
  extends Omit<React.ComponentProps<typeof AriaModal>, "children">,
    VariantProps<typeof sheetVariants> {
  children?: AriaDialogProps["children"];
  role?: AriaDialogProps["role"];
  closeButton?: boolean;
}

const DialogContent = ({
  className,
  children,
  side,
  role,
  closeButton = true,
  ...props
}: DialogContentProps) => (
  <AriaModal
    className={composeRenderProps(className, (className) =>
      cn(
        side
          ? sheetVariants({ side, className: "h-full p-6" })
          : "entering:fade-in-0 exiting:fade-out-0 entering:zoom-in-95 exiting:zoom-out-95 entering:slide-in-from-left-1/2 entering:slide-in-from-top-[48%] exiting:slide-out-to-left-1/2 exiting:slide-out-to-top-[48%] entering:animate-in exiting:animate-out exiting:duration-300 fixed top-1/2 left-[50vw] z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg md:w-full",
        className,
      ),
    )}
    {...props}
  >
    <AriaDialog
      role={role}
      className={cn(!side && "grid h-full gap-4", "h-full outline-none")}
    >
      {composeRenderProps(children, (children, renderProps) => (
        <>
          {children}
          {closeButton && (
            <AriaButton
              onPress={renderProps.close}
              className="entering:bg-accent entering:text-muted-foreground absolute top-4 right-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none disabled:pointer-events-none"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </AriaButton>
          )}
        </>
      ))}
    </AriaDialog>
  </AriaModal>
);

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className,
    )}
    {...props}
  />
);

const DialogTitle = ({ className, ...props }: AriaHeadingProps) => (
  <AriaHeading
    slot="title"
    className={cn(
      "text-lg leading-none font-semibold tracking-tight",
      className,
    )}
    {...props}
  />
);

const DialogDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className,
    )}
    {...props}
  />
);

export type { DialogContentProps };
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
