import { Card } from "fumadocs-ui/components/card";
import { Mail } from "lucide-react";
import Link from "next/link";
import type { FC } from "react";

import { DiscordIcon } from "../../icons-svg/discord-icon";

export const ContactSection: FC = () => (
  <Card className="brutal-card p-6" title="connect with reliverse">
    <p className="mb-6">
      this is not just code. it's a movement. join the community, share your weird ideas, and help
      us build tools with soul.
    </p>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <Link
        className="brutal-card flex items-center gap-3 p-4 transition-colors hover:bg-zinc-900 dark:hover:bg-zinc-800"
        href="https://discord.gg/Pb8uKbwpsJ"
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md">
          <DiscordIcon size={28} title="Discord logo" />
        </div>

        <div>
          <h4 className="font-bold">discord</h4>
          <p className="text-muted-foreground text-sm">join the reliverse server</p>
        </div>
      </Link>
      <Link
        className="brutal-card flex items-center gap-3 p-4 transition-colors hover:bg-zinc-500 dark:hover:bg-zinc-500"
        href="mailto:blefnk@gmail.com"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-indigo-500 text-white">
          <Mail className="h-6 w-6" />
        </div>
        <div>
          <h4 className="font-bold">email</h4>
          <p className="text-muted-foreground text-sm">blefnk@gmail.com</p>
        </div>
      </Link>
    </div>
    <div className="mt-8 space-y-4">
      <p>
        for the devs who still care at 3am,
        <br />
        for the ones who want to build a better world, not just a bigger one.
      </p>
      <blockquote className="my-4 border-foreground border-l-4 pl-4 italic">
        this is your invitation. let's build something that feels like home.
      </blockquote>
      <p>no ivory towers. no pitch decks. just code, community, and soul.</p>
    </div>
  </Card>
);
