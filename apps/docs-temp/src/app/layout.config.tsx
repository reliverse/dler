import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { BookIcon, HeartIcon } from "lucide-react";

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <svg
          aria-label="Logo"
          fill="none"
          height="24"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Terminal icon representing CLI */}
          <rect height="16" rx="2" stroke="currentColor" strokeWidth="2" width="20" x="2" y="4" />
          <path
            d="M7 9L10 12L7 15"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
          <path d="M13 15H17" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
        </svg>
        <span className="font-bold">Reliverse Docs</span>
      </>
    ),
  },
  links: [
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Get Started",
      url: "/docs",
    },
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Libraries",
      url: "/libraries",
    },
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Templates",
      url: "/templates",
    },
    {
      active: "url",
      icon: <HeartIcon />,
      text: "Donate",
      url: "https://github.com/sponsors/blefnk", // TODO: change to /donate when ready
    },
    {
      text: "GitHub",
      url: "https://github.com/reliverse/rempts",
      external: true,
    },
    {
      text: "npm",
      url: "https://www.npmjs.com/package/@reliverse/dler",
      external: true,
    },
  ],
};
