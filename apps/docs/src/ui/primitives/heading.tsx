import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

const headingVariants = cva("font-bold transition-colors", {
  defaultVariants: {
    size: "md",
    variant: "h2",
  },
  variants: {
    size: {
      lg: "text-lg",
      md: "text-base",
      sm: "text-sm",
    },
    variant: {
      h1: "scroll-m-20 border-b pb-2 font-extrabold text-3xl tracking-tight",
      h2: `
        scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight
        transition-colors

        first:mt-0
      `,
      h3: "scroll-m-20 font-semibold text-2xl tracking-tight",
      h4: "scroll-m-20 font-semibold text-xl tracking-tight",
    },
  },
});

interface HeadingProps {
  as?: "h1" | "h2" | "h3" | "h4";
  children: ReactNode;
  className?: string;
}

export function Heading({ as = "h2", children, className = "" }: HeadingProps) {
  return (
    <h2
      className={cn(
        headingVariants({
          size: "lg",
          variant: as,
        }),
        className
      )}
    >
      {children}
    </h2>
  );
}
