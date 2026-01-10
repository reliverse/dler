import type { FC } from "react";

export const ManifestoLoveList: FC = () => (
  <ul className="ml-6 list-disc space-y-2">
    <li>ukraine, ukrainian language & culture — non-negotiable</li>
    <li>tools that feel alive, loyal, and on your side — the reliverse way</li>
    <li>honest ux, clean dx — no compromises</li>
    <li>tools with soul, not just specs</li>
    <li>open source that feels like a mixtape — curated with love</li>
    <li>tools that innovate the way we work — like cursor, obsidian, polar</li>
    <li>
      devs who build because they're <em>passionate</em>, not for linkedin claps
    </li>
    <li>fast, safe, clean, sharp things — bun/typescript/..., esm/modularity/...</li>
    <li>brutal interfaces with honest intent</li>
    <li>
      weird ideas that make sense <em>after</em> 2am
    </li>
    <li>people who ship things even when no one claps</li>
    <li>writing code like it's poetry, not paperwork</li>
    <li>writing docs that make you feel something</li>
    <li>dark satire, brutal humor, anti-corporate vibes</li>
    <li>empathy, emotion, interaction — even in cli apps</li>
    <li>users who say "thank you" when using reliverse tools</li>
  </ul>
);

export const ManifestoRejectList: FC = () => (
  <ul className="ml-6 list-disc space-y-2">
    <li>russia, russian language & culture — non-negotiable</li>
    <li>tools that treat devs like clickers, not creators</li>
    <li>ai hype with no care for context or humanity</li>
    <li>blind vibe coding without substance</li>
    <li>
      any code that doesn't ask: <em>how will this feel to touch?</em>
    </li>
    <li>design systems that forgot how to feel</li>
    <li>js with unnecessary complexity and boilerplate</li>
    <li>overengineering when simplicity would do</li>
    <li>fake productivity metrics — real impact matters more</li>
    <li>typical hustle culture with zero humanity</li>
    <li>coaching bs, "free"-webinars guru talk, growth hacking nonsense</li>
    <li>pretentious fluff without soul — empty words, fake depth</li>
    <li>any tech that forgets it serves humans first</li>
  </ul>
);

export const ManifestoBelief: FC = () => (
  <div className="space-y-4">
    <p>
      we're not here to build the next big thing.
      <br />
      we're here to build the next <em>real</em> thing.
      <br />
      and maybe — just maybe — help someone breathe easier at 3am.
    </p>
    <p>
      code should feel.
      <br />
      users should trust.
      <br />
      creators should be weird, loud, emotional, <em>alive</em>.<br />
      coding isn't just logic — it's identity.
      <br />
      we build things that feel like rebellion.
      <br />
      not to win — to <em>mean</em> something.
    </p>
    <p>
      you don't need permission to care.
      <br />
      you just need to <em>still be human</em> in the middle of all this.
      <br />
      this is not about productivity.
      <br />
      this is about not going numb.
    </p>
    <p>
      <strong>how reliverse lives this: </strong>
      <br />- we ask "how will this feel?" before we ship
      <br />- we celebrate the weird, the broken, the honest
      <br />- we invite everyone who cares to join, question, remix
      <br />- we believe rebellion is better with friends
    </p>
  </div>
);

export const ManifestoOssVision: FC = () => (
  <div className="space-y-4">
    <i className="text-zinc-500">below are tips tailored specifically for oss projects.</i>
    <p>
      build your oss with the end in mind.
      <br />
      no gatekeeping. no copyright ego.
    </p>
    <p>
      your project isn't eternal. neither are you.
      <br />
      so leave something that <em>can evolve</em> without you.
    </p>
    <p>
      <strong>make it mit. </strong>
      <br />
      let the next dev fork it, twist it, make it scream in new ways.
      <br />
      let society remix your knowledge.
    </p>
    <p>
      <em>don't freeze the future just because your ego needs closure.</em>
    </p>
    <p>
      for example: <strong>unjs gave everything under mit. </strong>
      <br />
      because of that, <strong>reliverse builds something even better </strong>
      on top of their brilliance.
    </p>
    <p>
      and if your project is more than just code — if it's stories, docs, art, or lore —
      <br />
      <strong>let your content breathe too. </strong>
      <br />
      use <strong>creative commons</strong> for your words, images, and worlds.
      <br />
      <span className="text-zinc-500">
        (mit for code, cc by-sa or cc by-nc-sa for content — the classic handshake)
      </span>
      <br />
      let your ideas travel further than your repo.
    </p>
    <p>
      okay, okay — maybe your project needs more protection?
      <br />
      then use <strong>apache-2.0</strong> or something similar that protects without suffocating.
      <br />
      keep it oss, keep it a handshake, not a chokehold.
    </p>
    <p>
      but remember: restrictive licenses won't save you from corporate greed or ai scraping.
      <br />
      they'll just slow down the humans who could make it better.
    </p>
    <p className="italic">
      the truth is simple:
      <br />
      corps will find loopholes.
      <br />
      llms will scrape anyway.
      <br />
      but real creators — they're the ones who need the freedom to build.
    </p>
    <p>
      open source is a gift, not a cage.
      <br />
      if you want your code to outlive you —
      <br />
      let it breathe.
      <br />
      don't cage your code — let it become everyone's story.
    </p>
  </div>
);
