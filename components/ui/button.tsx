import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

const variants = cva("button", {
  variants: { variant: { primary: "button-primary", outline: "button-outline", quiet: "button-quiet" } },
  defaultVariants: { variant: "primary" },
});

export function buttonVariants(options?: VariantProps<typeof variants>) {
  return variants(options);
}

export function Button({ className, variant, ...props }: ComponentProps<"button"> & VariantProps<typeof variants>) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
