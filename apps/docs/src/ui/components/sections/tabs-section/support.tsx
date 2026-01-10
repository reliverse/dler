import { Card } from "fumadocs-ui/components/card";
import Link from "next/link";
import type { FC } from "react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/ui/primitives/button";

export const SupportTab: FC = () => (
  <Card className="brutal-card p-6" title="support reliverse">
    <div className="space-y-4">
      <p>
        you're not funding a startup.
        <br />
        you're backing indie infrastructure for a more human js world.
        <br />
        soulful, weird, duct-taped dreams that outlast the shiny stuff.
      </p>
      <h4 className="mt-6 mb-2 font-bold text-xl">why?</h4>
      <p>
        because we give a damn. because we're still human.
        <br />
        and because everything good breaks eventually—unless someone keeps showing up to fix it.
      </p>
      <p className="mt-4">your support =</p>
      <ul className="ml-6 list-disc space-y-2">
        <li>staying indie, loud, and weird</li>
        <li>more tools, more working code in the js ecosystem</li>
        <li>software that helps humans, not just algorithms</li>
      </ul>
      <div className="mt-6">
        <Link
          className={cn(
            buttonVariants({ size: "sm", variant: "secondary" }),
            `inline-block underline-offset-4 after:block after:h-px after:w-0 after:bg-current after:transition-all after:content-[''] hover:after:w-full`
          )}
          href="https://github.com/sponsors/blefnk"
          rel="noopener noreferrer"
          target="_blank"
        >
          support reliverse
        </Link>
      </div>
    </div>
  </Card>
);
