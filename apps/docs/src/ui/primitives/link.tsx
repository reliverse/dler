import NextLink from "next/link";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { buttonVariants } from "~/ui/primitives/button";

interface LinkProps {
  children: ReactNode;
  className?: string;
  href: string;
  rel?: string;
  sameTab?: boolean;
  size?: "default" | "icon" | "lg" | "sm";
  target?: "_blank" | "_parent" | "_self" | "_top";
  variant?: "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";
}

export function Link({
  children,
  className = "",
  href,
  sameTab = false,
  size = "default",
  target = "_self",
  variant = "secondary",
}: LinkProps) {
  // Determine if the link is external
  const isExternal = /^https?:\/\//.test(href);

  // Set target and rel based on whether the link is external and sameTab is false
  const linkTarget = isExternal && !sameTab ? "_blank" : target;

  const linkRel = isExternal && !sameTab ? "noopener noreferrer" : undefined;

  return (
    <NextLink
      className={cn(
        buttonVariants({
          size,
          variant,
        }),
        className,
        variant === "link" &&
          `inline-block underline-offset-4 after:block after:h-px after:w-0 after:bg-current after:transition-all after:content-[''] hover:after:w-full`
      )}
      href={href}
      rel={linkRel}
      target={linkTarget}
    >
      {children}
    </NextLink>
  );
}
