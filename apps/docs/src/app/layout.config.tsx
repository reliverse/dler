import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

import { BookIcon, HeartIcon } from "lucide-react";
import Image from "next/image";

import Logo from "~/img/favicon-32x32.png";

/**
 * Shared layout configurations
 *
 * layouts can be customised individually from:
 * Home Layout: app/(home)/layout.tsx
 * Blog Layout: app/blog/layout.tsx
 *
 * @see https://fumadocs.dev/docs/ui/navigation/links
 */
export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <>
        <Image alt="Logo" className="inline-block" height={24} src={Logo} width={24} />
        Relidocs
      </>
    ),
  },
  links: [
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Get Started",
      url: "/docs/intro",
    },
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Libs",
      url: "/docs/libs",
    },
    {
      active: "nested-url",
      icon: <BookIcon />,
      text: "Templates",
      url: "/docs/templates",
    },
    {
      active: "url",
      icon: <HeartIcon />,
      text: "Donate",
      url: "https://github.com/sponsors/blefnk", // TODO: change to /donate when ready
    },
  ],
};
