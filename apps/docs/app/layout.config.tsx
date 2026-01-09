import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
          aria-label="Rempts Logo"
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
        <span className="font-bold">Rempts</span>
      </>
    ),
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/AryaLabsHQ/rempts",
      external: true,
    },
    {
      text: "npm",
      url: "https://www.npmjs.com/package/rempts",
      external: true,
    },
  ],
};
