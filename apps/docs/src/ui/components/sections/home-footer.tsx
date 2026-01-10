"use client";

import { Card } from "fumadocs-ui/components/card";
import type { FC } from "react";

export const Outro: FC = () => {
  return (
    <section className="outro-content mb-12">
      <Card className="brutal-card p-6" title="ready to build differently?">
        <p className="mb-4">
          this is your invite. build tools with soul. join the reliverse movement.
        </p>
        <div className="mt-6 space-y-4">
          <p>
            broken things can be beautiful.
            <br />
            let's build a universe where devs don't fight their tools.
          </p>
          <p>thanks for caring about the future of code.</p>
          <p className="text-xl">🩷 reliverse</p>
        </div>
      </Card>
    </section>
  );
};

export const HomeFooter: FC = () => {
  return (
    <footer className="footer-content text-center text-muted-foreground text-sm">
      <p>&copy; {new Date().getFullYear()} reliverse. all rights reserved.</p>
      <p className="mt-2">built with soul. intentionally different.</p>
    </footer>
  );
};
