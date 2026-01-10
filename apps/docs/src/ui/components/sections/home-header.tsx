"use client";

import Link from "next/link";
import type { FC } from "react";

import { SOCIAL_LINKS } from "~/lib/constants";
import { Button } from "~/ui/primitives/button";

interface SocialButtonProps {
  href: string;
  icon: FC<{ className?: string }>;
  label: string;
}

const SocialButton: FC<SocialButtonProps> = ({ href, icon: Icon, label }) => (
  <Link href={href} rel="noopener noreferrer" target="_blank">
    <Button aria-label={label} className="brutal-button" size="icon" variant="outline">
      <Icon className="h-5 w-5" />
    </Button>
  </Link>
);

export const HomeHeader: FC = () => {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="hero-header">
        <h1
          className="glitch-text mb-2 font-bold text-4xl md:text-5xl"
          data-text="reliverse"
          id="main-title"
        >
          reliverse
        </h1>
        <p className="text-lg text-muted-foreground">js ecosystem modernization movement.</p>
        <p className="text-muted-foreground text-sm">
          focused on clean dx, honest ux, and tools you actually want to use.
        </p>
      </div>
      <nav aria-label="social links" className="hero-social flex gap-3">
        {SOCIAL_LINKS.map(({ href, icon, label }) => (
          <SocialButton href={href} icon={icon} key={href} label={label} />
        ))}
      </nav>
    </div>
  );
};
