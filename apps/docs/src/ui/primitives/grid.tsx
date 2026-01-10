import type { HTMLAttributes, RefObject } from "react";

import { cn } from "~/lib/utils";

type GridProps = HTMLAttributes<HTMLDivElement> & {
  columns?: ResponsiveValue;
  gap?: ResponsiveValue;
};
type ResponsiveValue = number | { [breakpoint: string]: number };

const BREAKPOINTS = ["sm", "md", "lg", "xl", "2xl"];

/**
 * Convert a responsive prop value (e.g. { base: 1, md: 2, lg: 4 })
 * into Tailwind utility classes.
 *
 * - **base** → no prefix
 * - sm / md / lg / xl / 2xl → `{bp}:{class}`
 */
function responsiveToClasses(value: ResponsiveValue | undefined, prefix: string): string[] {
  if (value === undefined) return [];

  // single number → just one class
  if (typeof value === "number") return [`${prefix}-${value}`];

  // object form
  return Object.entries(value).map(([breakpoint, val]) => {
    // treat "base" specially (no breakpoint prefix)
    if (breakpoint === "base") return `${prefix}-${val}`;

    // for known breakpoints use the usual prefix
    if (BREAKPOINTS.includes(breakpoint)) {
      return `${breakpoint}:${prefix}-${val}`;
    }

    // fall-back (should rarely happen)
    return `${prefix}-${val}`;
  });
}

const Grid = ({
  children,
  className,
  columns = 2, // default grid-cols-2
  gap = 4, // default gap-4
  ref, // default gap-4
  ...props
}: GridProps & { ref?: RefObject<HTMLDivElement | null> }) => {
  const columnClasses = responsiveToClasses(columns, "grid-cols");
  const gapClasses = responsiveToClasses(gap, "gap");

  const gridClass = cn("grid", ...columnClasses, ...gapClasses, className);

  return (
    <div className={gridClass} ref={ref} {...props}>
      {children}
    </div>
  );
};

Grid.displayName = "Grid";
export { Grid };
