"use client";

import type { VariantProps } from "class-variance-authority";
import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
  composeRenderProps,
} from "react-aria-components";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button";

interface LinkProps
  extends AriaLinkProps,
    VariantProps<typeof buttonVariants> {}

/**
 * 画面遷移用のリンク。
 * variant / size を渡すとボタンと同じ見た目になり、
 * 省略すると className だけが当たる素のリンクになる。
 */
const Link = ({ className, variant, size, ...props }: LinkProps) => {
  return (
    <AriaLink
      className={composeRenderProps(className, (className) =>
        cn(
          variant || size ? buttonVariants({ variant, size }) : null,
          className,
        ),
      )}
      {...props}
    />
  );
};

export type { LinkProps };
export { Link };
