import { Card } from "fumadocs-ui/components/card";
import type { FC } from "react";

export const AboutTab: FC = () => (
  <Card className="brutal-card p-6" title="what is reliverse">
    <div className="space-y-4">
      <p>
        reliverse is a movement to modernize the js ecosystem.
        <br />
        tools that feel alive, loyal, and on your side.
        <br />
        code that flows, not fights.
      </p>
      <p>
        we build for humans and machines—no dark patterns, no fake productivity, just focused
        software that quietly says:
      </p>
      <blockquote className="my-4 border-foreground border-l-4 pl-4 italic">
        hey. we did the thing. you're welcome.
      </blockquote>
      <p>
        this isn't about hype or clout. it's about making the boring things fast, safe, and
        invisible. it's about building a universe where you don't have to fight your tools anymore.
      </p>
    </div>
    <h3 className="mt-8 mb-4 font-bold text-xl">what we do</h3>
    <ul className="space-y-2">
      <li className="flex items-start gap-2">
        <span className="text-xl">🌌</span>
        <span>tools that feel alive</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-xl">🔧</span>
        <span>the reliverse: dev tools with weird little hearts</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-xl">🧱</span>
        <span>design for developer feeling, not fake productivity</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-xl">✍️</span>
        <span>stories, essays, and code that make you feel something</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-xl">📦</span>
        <span>templates and libraries—skip boilerplate, ship soul</span>
      </li>
    </ul>
  </Card>
);
