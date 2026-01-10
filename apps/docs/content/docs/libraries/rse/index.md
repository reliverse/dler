---
title: Reliverse CLI
description: A powerful CLI that helps you effortlessly create new web projects, manage existing ones, and apply advanced, automated modifications to your codebase.
---

## rse cli (prev. reliverse cli)

> **@reliverse/rse** is your all-in-one daily dev companion — not just for bootstrapping projects, but for extending your entire dev toolchain. rse brings smart automation, framework-aware support (like next.js), and an ai-powered toolbox into your terminal. code, refactor, generate, integrate — all in one flow.

[sponsor](https://github.com/sponsors/blefnk) — [discord](https://discord.gg/Pb8uKbwpsJ) — [github](https://github.com/reliverse/rse) — [npm](https://npmjs.com/@reliverse/rse) — [introduction](https://blefnk.reliverse.org/blog/my-projects/cli)

## Quick Start

_Prerequisites: [Git](https://git-scm.com/downloads), [Node.js](https://nodejs.org), [Bun](https://bun.sh)_

1️⃣ **Install**: `bun i -g @reliverse/cli` • 2️⃣ **Use**: `reliverse cli` • 3️⃣ **Update (if needed)**: `reliverse update`

## features

- 🦾 **superapp for devs**: one cli, endless power. spin up, refactor, deploy, use ai, and more.
- ⚖️ **reliverse.org cli**: rse is the official cli for [reliverse.org](https://reliverse.org) app.
- 🚀 **start fast or load up**: use ready-to-go templates or pick up where you left off.
- 🌐 **one-shot ops**: bootstrap, push to github, deploy to vercel — all in one go.
- 😉 **flexible bootstrapping**: clone an existing `template` or create a new project with your preferred `stack`.
- 😊 **different templates**: select specific template (from the list or by providing a custom link to a github repo) or ask rse to narrow the list to templates which contain your prefferences.
- 🤝 **different stack providers**: `reliverse-stack`, `better-t-stack` (and more coming soon). you have a freedom to use any provider for your project bootstrap.
- 😜 **not limited to web apps**: you can bootstrap any kind of project — web/mobile/desktop apps, npm/jsr libraries (incl. shadcn-based component libraries), cli tools, vscode/browser/eslint extensions, better-auth/eslint plugins, etc. everything can be bootstrapped as a single repo or monorepo. (please note: at the moment, not everything described in this list point is fully implemented, but it's coming soon)
- 😋 **better better-auth cli**: use `rse better auth` to use improved version of [better-auth cli](https://better-auth.com/docs/concepts/cli), which is more stable and natively works with bun, thanks to [@reliverse/rempts](https://github.com/reliverse/rempts).
- 🔧 **refactor safely**: add popular libs, and keep your codebase happy.
- ⚙️ **automate**: boring setup (eslint, env files, etc) — let the cli handle it.
- 🏗️ **works great with next.js**: plays well with other frameworks too.
- ⏬ **auto-clones repos/templates**: and configures them smartly.
- 🔌 **integrate**: tools into your codebase. use `create/edit project manually`.
- ⚡ **full-featured, small and fast**: probably the most tiny cli with the most powerful set of features.

## Introduction

**Reliverse CLI** is your all-in-one command-line companion for _setting up_ and _enhancing_ web projects. Starting fresh or upgrading an existing app? This tool helps you:

- **Effortlessly create projects**: Spin up new web apps or import existing templates in a flash.  
- **Apply powerful codemods**: Safely refactor code and integrate popular libraries.  
- **Automate configuration**: Set up ESLint, Prettier, Biome, `.env` files, Git hooks, and more.  
- **Support multiple frameworks**: Enjoy seamless compatibility with Next.js, React, Vue, Svelte, Astro, and beyond.  
- **Customize with templates**: Clone pre-built templates and merge them conflict-free.  
- **Automate GitHub & deployments**: Quickly create repositories, push commits, and deploy to Vercel.  
- **Extend functionality**: Upcoming Reliverse Addons enable even more features and integrations.

Although it’s built primarily for JavaScript/TypeScript (especially React and Next.js), @reliverse/cli is flexible enough to grow beyond web development, streamlining workflows with a single, powerful CLI.

## getting started

make sure you have git, node.js, and bun/pnpm/yarn/npm (**[bun](https://bun.sh/get) is highly recommended**) are installed. then:

### get started

#### 1. install

- **globally**: `bun add -g @reliverse/rse`
- **or as dev dep**: `bun add -D @reliverse/rse`

(_if you want you can install rse globally and as dev dep in your project_)

#### 2. update

- **if installed globally**: `rse update` (or: `bun update -g --latest`)
- **if installed as dev dep**: `bun update -D @reliverse/rse`

#### 3. customize config

- a `.config/rse.{ts,jsonc}` file is generated on first run.  
- customize it to fit your project and tweak cli behavior.  
- changes apply on next launch (hot-reload coming soon).
- config customization is optional, but recommended.

When you run `reliverse cli`, a `reliverse.jsonc` or `reliverse.ts` file is created in your project root. You can edit it at any time to customize your CLI behavior. Simply restart the CLI to apply changes.

Installing Other Templates:

Use `reliverse cli` to clone any public GitHub repository:

1️⃣ Choose “Clone an existing repository” • 3️⃣ Provide the repository link • 4️⃣ Reliverse will clone and configure it automatically.

#### 4. run and enjoy

- **if installed globally**: `rse cli`
- **if installed as dev dep**: `bun rse cli`
- **usage without installing**: `bunx @reliverse/rse@latest cli`

## show some love 🫶

if `@reliverse/rse` saved you time or made you smile:

- support on [github sponsors](https://github.com/sponsors/blefnk)
- or drop a ⭐️ on [github](https://github.com/reliverse/rse)

it helps more than you think! thanks for being here.

## commands

please visit a separate [rse commands](./cmds.md) page to see all available commands.

## api (for advanced users)

- the sdk lets you build custom rse cli plugins, interact with [reliverse.org](https://reliverse.org), or power up your own clis.
- no need to reinvent the wheel — [@blefnk](https://github.com/blefnk) already took care of the hard parts.
- if it saves you time, [consider making a small donation](https://github.com/sponsors/blefnk) 🩷 to support ongoing development.

```sh
bun add @reliverse/rse-sdk
```

## stack providers

the main principle on which the rse ecosystem stands is collaboration and creating the most convenient dx possible. the more friends we have, the better our projects become. that's why rse doesn't strive to be the only one—rse just strives to be really useful. the usefulness of rse is that you don't need to install many different tools to do many different things. rse aims to become an all-in-one tool that runs the tools best suited for your many tasks.

that's why rse gives you the opportunity to use not only its native reliverse-stack for bootstrapping your project, but also the stacks of our good friends. here's what you can choose from after you click `create a brand new project`:

- ✅ [reliverse-stack](https://reliverse.org/rse/providers/reliverse-stack) ([donate](https://github.com/sponsors/blefnk)) ([star](https://github.com/reliverse/rse)) — a narrow collection of bootstrap options, especially a great choice for beginners who do not yet understand what options are really the best for them.
- 🏗️ [better-t-stack](https://reliverse.org/rse/providers/better-t-stack) ([donate](https://github.com/sponsors/AmanVarshney01)) ([star](https://github.com/AmanVarshney01/create-better-t-stack)) — a comprehensive collection of different bootstrap options.
- 🔜 [shadcn](https://ui.shadcn.com) — one-click project setup, automated actions described in the shadcn/ui docs. if shadcn already detected in your project, rse will display you a multi-select prompt what components you want to install (only displayed components which are not already installed).
- 🔜 **remote stacks**: any repo, which contains `.config/dler.ts` and `.config/*-dler-pack/*-mod.ts`, will be available for use as a stack. (see [reliverse.org/rse/stacks](https://reliverse.org/rse/stacks) to apply your own or someone else's open-source stack)

(get bonus perks on rse and [reliverse.org](https://reliverse.org) by donating to the creators of the stacks, each stack gives its own perks)

> want to add your/someone else's cli? please open a pr or [create an issue](https://github.com/rse/rse/issues/new) or apply on [reliverse.org/rse/stacks](https://reliverse.org/rse/stacks). requested stack will be packed with [`dler pack`](https://github.com/reliverse/dler) and will be available for anyone to use.

by choosing a stack other than reliverse-stack, you will still have access to all the features provided by rse—such as pushing to github, deploying to vercel, further updating your bootstrapped project, and so on.

**legend**:

- ✅ well tested
- 🏗️ recently added, not well tested yet
- 🔜 coming soon

## templates

similar to stack providers, rse has a list of templates, which you can choose from (note: not everything is integrated yet).

- ✅ [relivator](https://github.com/blefnk/relivator)
- ✅ [versator](https://github.com/blefnk/versator)
- 🔜 [nexfaster](https://github.com/rudrodip/nexfaster)
- 🔜 [chat-sdk](https://github.com/vercel/ai-chatbot)
- 🔜 [chat0](https://github.com/senbo1/chat0)
- 🔜 [nuxt.new](https://nuxt.new)
- 🔜 [react-tanstarter](https://github.com/dotnize/react-tanstarter)
- 🔜 more free and paid templates coming soon (see [reliverse.org/rse/templates](https://reliverse.org/rse/templates) to apply your own template or someone else's open-source template)

## contribute, please 😽

- everything you see in rse so far is **built by one person** ([@blefnk nazar kornienko](https://github.com/blefnk)) — with love, caffeine, and way too many terminal tabs.
- got feedback, ideas, bugs, or just wanna vibe? [hop into my discord](https://discord.gg/pb8ukbwpsj) — i'd love to chat.
- whether you want to code, brainstorm, fix typos, or just hang out — you're always welcome here.  
  no pressure, no gatekeeping — just good energy and open-source fun.

### <🏗️1> come together, right now

two ways to clone this repo and contribute:

**classic way**:

```bash
git clone https://github.com/rse/rse.git
cd cli
code . # opens vscode
```

**rse way**:

```bash
rse cli
> clone an existing repository
> developer related  
> rse  
> cli
> y/n # opens default editor
```

boom. you're in.

### <🏗️2> you're a magician, do magic

1. run `bun latest` to install dependencies and keep things fresh.
2. use ai (rse, cursor, whatever floats your dev boat) or write code manually.
3. `bun dev:command` works just like `rse <command> --dev`.
4. run `bun check` to make sure everything's clean and happy.
5. all done? commit and push your changes your way:

**classic way**:

```bash
git add .
git commit -m "your commit message"
git push
```

**rse way**:

```bash
rse cli
> commit
<your commit message>
<press enter to push>
```

### <🏗️3> what a great time to live

- all done? high five! 🖐️
- head to [repo](https://github.com/rse/rse/pulls) & open a pr.
- that's it. you're amazing.

thanks for being part of this!

## Collaborate & Contribute

I love community input! Check out my [Contributing Guide](https://docs.reliverse.org/docs/intro/contributing/) for how to get involved or propose new features.

If you’re interested in deeper collaboration or partnership, [join my Discord community](https://discord.gg/Pb8uKbwpsJ) to chat with us directly.

## Support

If Reliverse saves you time and effort, please consider supporting its development:

- [GitHub Sponsors](https://github.com/sponsors/blefnk)  
- [Patreon](https://patreon.com/blefnk)  
- [PayPal](https://paypal.me/blefony)

Even a simple ⭐ on [GitHub](https://github.com/reliverse/cli) shows your love!

Thanks! Happy Reliversing!

## todo

- [ ] call `applyMagicSpells()` in the end of bootstrapping packed by `dler pack` templates

## shoutout 😘

- [amanvarshney01/create-better-t-stack](https://github.com/amanvarshney01/create-better-t-stack#readme) ([donate](https://github.com/sponsors/amanvarshney01))
- [t3-oss/create-t3-app](https://github.com/t3-oss/create-t3-app#readme) ([donate](https://github.com/sponsors/juliusmarminge))

## stand with ukraine

- 💙 help fund drones, medkits, and victory.
- 💛 every dollar helps stop [russia's war crimes](https://war.ukraine.ua/russia-war-crimes) and saves lives.
- 👉 [donate now](https://u24.gov.ua), it matters.

## stand with reliverse

- ⭐ [star the repo](https://github.com/reliverse/rse) to help reliverse community grow.
- 🦄 follow this project's author, [nazar kornienko](https://github.com/blefnk) & [reliverse](https://github.com/reliverse), to get updates about new projects.
- 💖 [become a sponsor](https://github.com/sponsors/blefnk) and power the next wave of tools that _just feel right_.
- 🧑‍🚀 every bit of support helps keep the dream alive: dev tools that don't suck.

> Built with love. Fueled by purpose. Running on caffeine.

## license

[mit](LICENSES) © 2025 [nazar kornienko (blefnk)](https://github.com/blefnk), [reliverse](https://github.com/reliverse)
