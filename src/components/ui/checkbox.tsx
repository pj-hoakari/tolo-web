"use client";

import { Check, Minus } from "lucide-react";
import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  type CheckboxGroupProps as AriaCheckboxGroupProps,
  type CheckboxProps as AriaCheckboxProps,
  type ValidationResult as AriaValidationResult,
  composeRenderProps,
  Text,
} from "react-aria-components";

import { cn } from "@/lib/utils";

import { FieldError, Label, labelVariants } from "./field";

const CheckboxGroup = AriaCheckboxGroup;

const Checkbox = ({ className, children, ...props }: AriaCheckboxProps) => (
  <AriaCheckbox
    className={composeRenderProps(className, (className) =>
      cn(
        "group/checkbox flex items-center gap-x-2",
        /* Disabled */
        "disabled:cursor-not-allowed disabled:opacity-70",
        labelVariants,
        className,
      ),
    )}
    {...props}
  >
    {composeRenderProps(children, (children, renderProps) => (
      <>
        <div
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-sm border border-primary text-current ring-offset-background",
            /* Focus Visible */
            "group-focus-visible/checkbox:outline-none group-focus-visible/checkbox:ring-2 group-focus-visible/checkbox:ring-ring group-focus-visible/checkbox:ring-offset-2",
            /* Selected */
            "group-indeterminate/checkbox:bg-primary group-selected/checkbox:bg-primary group-indeterminate/checkbox:text-primary-foreground group-selected/checkbox:text-primary-foreground",
            /* Disabled */
            "group-disabled/checkbox:cursor-not-allowed group-disabled/checkbox:opacity-50",
            /* Invalid */
            "group-invalid/checkbox:border-destructive group-invalid/checkbox:group-selected/checkbox:bg-destructive group-invalid/checkbox:group-selected/checkbox:text-destructive-foreground",
            /* Resets */
            "focus:outline-none focus-visible:outline-none",
          )}
        >
          {renderProps.isIndeterminate ? (
            <Minus className="size-4" />
          ) : renderProps.isSelected ? (
            <Check className="size-4" />
          ) : null}
        </div>
        {children}
      </>
    ))}
  </AriaCheckbox>
);

interface JollyCheckboxGroupProps extends AriaCheckboxGroupProps {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: AriaValidationResult) => string);
}

function JollyCheckboxGroup({
  label,
  description,
  errorMessage,
  className,
  children,
  ...props
}: JollyCheckboxGroupProps) {
  return (
    <CheckboxGroup
      className={composeRenderProps(className, (className) =>
        cn("group flex flex-col gap-2", className),
      )}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          <Label>{label}</Label>
          {children}
          {description && (
            <Text className="text-sm text-muted-foreground" slot="description">
              {description}
            </Text>
          )}
          <FieldError>{errorMessage}</FieldError>
        </>
      ))}
    </CheckboxGroup>
  );
}

export type { JollyCheckboxGroupProps };
export { Checkbox, CheckboxGroup, JollyCheckboxGroup };
