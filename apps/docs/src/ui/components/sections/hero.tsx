"use client";

import Image from "next/image";
import type { FC } from "react";

import GlitchyReliverse from "~/img/glitch.png";

export const Hero: FC = () => {
  return (
    <header className="mb-2">
      <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
        <div className="hero-content">
          <h2 className="typewriter mb-4 font-bold text-2xl" id="hero-title">
            the reliverse commitment
          </h2>
          <div className="space-y-4 text-lg">
            <p>
              imagine a js ecosystem where tools feel alive, loyal, and on your side.
              <br />
              where speed respects your time, clarity respects your mind, and trust respects your
              dreams.
            </p>
            <p>
              no more fighting your stack. no more endless config pain. just code that flows, tools
              that disappear into the background, and a universe that actually gives a damn about
              your flow.
            </p>
            <p>
              this is reliverse: it's a movement to rewrite how we feel about building.
              <br />
              join the commitment. build with soul, not just specs.
            </p>
          </div>
        </div>
        <div className="hero-image vhs-effect">
          <Image
            alt="Reliverse Logo"
            className="brutal-border h-auto w-full"
            height={500}
            placeholder="blur"
            priority
            src={GlitchyReliverse}
            width={500}
          />
        </div>
      </div>
    </header>
  );
};
