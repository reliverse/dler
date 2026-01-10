---
title: What's New Changelog
description: The changelog of what's new in Versator Next.js Template.
---

_This post was updated on December 11, 2024_.

## **v1.3.0 RC.1 is Already Here! 🎉**

**We're excited to announce the release of Versator 1.3.0 RC.1 🎉**
_It comes with stable Next.js 15.1 and React 19_ ✨

It has been a long journey that we, my dear community, have traveled together.
_The full 1.3.0 release with all pages enabled is coming very soon!_ 🚀
Thank you for all your support! Enjoy!

<https://versator.com/en>

**💡 You can already try out the upcoming 1.3.0 version of Versator! Although the branch is currently named `RC` or `canary` – don't pay attention to that — it's more stable than 1.2.6!**

Try Versator 1.3.0 ahead of everyone else! Get an early look at what's coming soon! 1.3.0@RC is more stable than 1.2.6!

## **v1.3.0-canary.0 is now published on GitHub!**

> Versator 1.2.6 has lived its first day 🎉! It has already been liked by many! Thank you all for your feedback! :pray:

I stayed up all night to finally make the 1.2.6 release. The journey to version 1.2.6 was really long and tough. After the release, I took a walk and then went to sleep. This helped me come up with a temporary solution for issues, presented in 1.2.6, related to Turbopack and next-intl. For some reason, I didn't encounter these issues during the last tests, but now they have appeared.

The simplest solution: temporarily downgrade from Next.js 15 (canary.101) to Next.js 14 (latest). So, if you already have 1.2.6, you can do this by running the command: "npx nypm add react@latest react-dom@latest next@latest sharp@latest". However, it's better to install the fresh Versator update, as you'll encounter several problems if you only run this command.

_Please install this new v1.3.0-canary.0 version._ This first v1.3.x version (the first Versator's canary branch version ever!) contains a temporary downgrade to Next.js 14 and React 19, along with some additional improvements. This update also temporarily disables some files that use new React 19 features like useActionState, but these files are not yet complete, so you won't lose anything. This update also fixes the header's UI on small screen widths.

By the way, using React 18 and Next.js 14 will give you a "cleaner" console when using `pnpm install`, as many libraries have not yet included next/react rc/canary in their peerDependencies. Additionally, if you are using pnpm, which is recommended until the full release of 1.3.0 (bun will then become the default instead), you can play around with the pnpm configuration, which is truly flexible. You can read about it in the [pnpm docs article](https://pnpm.io/package_json).

## Stay Tuned for More Updates

**This changelog is still being updated. While you're welcome to read it now, check back later for more information. The newly revised [README.md](https://github.com/blefnk/versator#readme) also contains valuable insights into this update.**

## Git Release Notes

**Full Commit Changelog:** <https://github.com/blefnk/versator/compare/1.2.5...1.2.6>

---

**✅ Versator 1.2.6 uses the following dependencies (only some are listed)**: Next.js 15, React 19, TypeScript 5.5/5.6, Tailwind 3/4, tRPC 11, Clerk 5, Auth.js 5, ESLint 9 (with multiple plugins like typescript-eslint 8, react, unicorn, sonarjs, perfectionist, tailwindcss, readable-tailwind, import-x, jsx-a11y, security, markdown, mdx, json), Biome, Stripe, Million, Reliverse, next-intl, shadcn/ui, radix-ui, react-query, pnpm, zod, cn, turbo, Drizzle (Postgres, MySQL, SQLite, Neon, Railway, PlanetScale, Turso), GSAP, SWR, Resend, react-email, next-themes, Putout, Flowbite, Udecode, Slate, uploadthing, Radash, CSpell, TypeStat, Lucide & Radix Icons, Vercel & Loglib Analytics, Axios, Day.js, Embla Carousel, Execa, Math.js, UnJS libs (consola, fs-extra, pathe, etc), and much more

**[upd. 18.08.2024]** You can now try out the first published Reliverse Addon – [@reliverse/fs](https://github.com/reliverse/fs#readme), which is already available and used in Versator! **🎉 The upcoming Versator 1.3.0 will have as few dependencies as possible.** Everything will work thanks to @reliverse/addons. Everything will be separated into its own libraries and will be published on npmjs and/or jsr. You will be able to install exactly what you need, including functionality and UI. You will have two options. One is to install the addons the classic way using 'package.json'. The other option is that all these addons can also be installed in a style inspired by shadcn/ui, where you keep all the content directly in your project (as it is currently in test mode in Versator 1.2.6 (please check `addons` folder or run `bun addons`)), although the first option will be recommended for the most use cases. 'addons' folder already contains many cool things, especially related to codemods. It also includes the @reliverse/academy game, where you can check how good you know JavaScript/TypeScript, React/Next.js, Versator/Reliverse, and even ESLint, ecosystems (you will even find there table of records and will can contest with other players if you share data/players.json and data/progress.json save files to them; the game has also achievement system).

**What About the Future? Any News on 1.3.0?**

**🎉 The upcoming Versator 1.3.0 will have as few dependencies as possible! Finally!**

I'm ([blefnk](https://github.com/blefnk)) working to automate the Versator's developer experience as much as possible, including the installation process. The upcoming version 1.3.0 will feature significant automated installation. If you wish to try the initial alpha version of one of my many automation scripts, use the `bun deps:install` (or `bun deps:install-all`) command. This script already allows you to install and remove project packages, and it also works as a linter. You can check the comprehensive number of predefined commands configured inside the 'scripts' section of the 'package.json' file. However, before running this script, you should manually install the essentials:

- `npx npm add typescript tsx npm @mnrendra/read-package @clack/prompts`
- `npx npm add fs-extra pathe fast-npm-meta semver @types/semver redrun axios`
- `bun |yarn|bunx jsr add @reliverse/core` (or: `npx jsr add @reliverse/core`)

Thanks to @reliverse/addons, everything now works smoothly with fewer dependencies. In the future, each feature and component will be split into its own library and published on [npmjs](https://npmjs.com) and/or [jsr](https://jsr.io), so you can install only what you need. With the future Versator 1.3.0 version, you won't have to deal with unnecessary components in web templates anymore. You get the core package and can add features and UI components as you need them.

The 'addons' folder is divided into two parts: terminal context and browser context (it's everything, excluding the 'addons/scripts' folder). The 'addons/scripts' folder contains functions used by the CLI (command line interface), while the 'src' and 'addons/*' folders (excluding 'addons/scripts') are for the browser, since the browser doesn't support certain JS features. So, while 'addons/scripts' has everything needed for the whole app, not everything can import from 'addons/scripts'.

You’ll have two installation options: the classic method using 'package.json' or a new approach inspired by shadcn/ui, where you keep all the content directly in your project (currently in test mode in Versator 1.2.6—check the `addons` folder or run `bun addons`). While the classic method is recommended for most cases, feel free to explore the new approach!

The 'addons' folder is already packed with many exciting features, especially related to codemods, and includes the **@reliverse/academy game**. This game allows you to test your knowledge of JavaScript/TypeScript, React/Next.js, Versator/Reliverse (make food/tea/coffee before trying this test—it has a lot of questions!), and even ESLint v9 ecosystems. It features a leaderboard, enabling you to compete with others by sharing `data/players.json` and `data/progress.json` save files. Plus, an achievement system keeps you motivated!

I can’t wait for you to experience the new and improved Versator 1.3.0! But to make 1.3.0 truly stable, production-ready, and just great, let's first work together on Versator v1.3.0-canary.0, which is coming soon! If you want to get it even faster, there is now a 'dev' branch. I recently opened the project pages on financial support platforms, and currently, any contribution grants you access to the 'dev' branch. Thank you for your attention!

---

## 1.2.6 – The Resurrection Update

The long-awaited Versator 1.2.6 update was released on August 4, 2024 – bringing significant improvements and a glimpse into the future of Versator.

> I'm currently in the process of migrating the documentation from Versator's README.md to this site (Versator & Reliverse Docs). I plan to divide everything into appropriate sections. During the migration, some things might not work properly. Please let us know if you encounter any issues.

<!-- ![Versator v1.2.6 OG Image](/og.png) -->

**The Huge Versator 1.2.6 is Already Available!**

Versator 1.2.6 was released on August 4, 2024! I'm now actively working on the next major update, Versator 1.3.0, with the goal of making the project production-ready, clean, and high-quality. I invite you to join us in actively searching for issues, contributing freely, and earning cool rewards. A canary branch was launched a few days ago (and is available to everyone in the main repo), and the dev branch is also now available (the dev branch is available for a limited time to all sponsors at any paid pledge level).

**🔥 Important Note:** Versator currently requires specifying Clerk environment variable keys, as its API has changed. I'm working on making Clerk optional again. However, all other environment variables are optional. If this statement is incorrect and something is broken, please let us know.

## Versator 1.2.6 (August 4, 2024): The Resurrection Update

**Versator is Back With Version 1.2.6 🥳!**

I'm thrilled to announce the release of Versator 1.2.6! This update marks a significant shift away from the "all-in-one" approach, paving the way for a modular future starting with Reliverse CLI in version 1.3.0. This release includes major updates, particularly enhancing the developer experience (DX). The README.md has been thoroughly revamped. Moving forward, I will introduce new version management branches: Dev (early-access for sponsors), Canary, Release Candidate (RC), and General Availability (GA). Version 1.2.6 serves as a solid foundation, enabling a smoother transition to the 1.3.0 branches.

### Major Changes and Improvements

- **Updated Dependencies:** We've upgraded to next-auth v5, clerk v5, with optional support for tailwindcss v4. Work on migrating from React 18 to React 19 has also begun.
- **Final Dual-Integration Release:** This is the last version supporting both PostgreSQL/MySQL and NextAuth.js/Clerk database integrations. Check out the updated Installation section in the README.md for more details.

### Migration Guidance

Starting with version 1.3.1, I will offer comprehensive migration guides. The usual process involves reviewing commit changes and integrating updates into your custom code. However, due to the extensive modifications in versions 1.2.6 and 1.3.0, this method is impractical. I recommend reinstalling the project and migrating your custom features from the previous version to the new starter version. I appreciate your understanding!

For a smoother migration, use an "`addons/cluster`" folder and move all your custom code there. If necessary, use the [Find and Replace](https://code.visualstudio.com/docs/editor/codebasics#_search-and-replace) feature in VSCode to adjust paths. This will simplify the process of transferring your custom code to Versator 1.2.6.

Please note that the relative paths to the `src` folder use `~`, while paths to `addons` use `@`.

### Default Database Change

Neon PostgreSQL is now the default database, replacing PlanetScale MySQL, which no longer offers a free tier. If you still need MySQL, [Railway](https://railway.app?referralCode=sATgpf) provides an affordable alternative with a $5 credit without requiring a credit card. Please note that this version has been primarily tested with Neon PostgreSQL.

### Security and Code Improvements

- **Enhanced Type Safety and Editor Autocomplete:** We've improved type safety and editor autocomplete for Drizzle ORM libraries.
- **Biome Replaces Prettier:** Prettier has been removed in favor of Biome. The Prettier config will be removed from the `src/temp` folder in the next version. You can re-add it by running the `reliverse` command starting with Versator 1.3.0.

### Reliverse Scripts Transition

Reliverse scripts have advanced from the "unknown viability" stage to the "unstable" stage. As always, use them at your own risk and make backups. These scripts are now located in the `src/tools/unstable` folder and require Python to run.

For more details, check out my posts in the Versator thread on Discord, starting with [this message](https://discord.com/channels/1075533942096150598/1155482425862922370/1241995095125786624).

### Thank You for Your Support

If you have any questions or issues, feel free to contact me, @blefnk, on Discord or GitHub. For more information about versions 1.2.6 and 1.3.0, visit the `#⭐-versator` chat on my Discord server or check out the [GitHub Issues](https://github.com/blefnk/versator/issues) page.

Thank you for your continued support, and happy coding with the [Reliverse Website Builder v0.4.0](https://github.com/blefnk/reliverse-website-builder) and [Versator Next.js Template v1.2.6](https://github.com/blefnk/versator)!

## Stay Tuned for More Updates 1.2.6

**This changelog is still being updated. While you're welcome to read it now, check back later for more information. The newly revised [README.md](https://github.com/blefnk/versator#readme) also contains valuable insights into this update.**

## Git Release Notes 1.2.6

**Full Commit Changelog:** <https://github.com/blefnk/versator/compare/1.2.5...1.2.6>

---

_a.k.a. What's Happening?!_

## 1.2.6 - August 4, 2024 – The Resurrection Update

Below you can see a small copy of [the article from Reliverse Docs](https://reliverse.org/versator/v126), which is possibly outdated. Please refer to [1.2.6 Release Notes Page on GitHub](https://github.com/blefnk/versator/releases/tag/1.2.6) or to [this blog post](https://reliverse.org/versator/v126) to read the most recent version. Reliverse Docs also has translations of the article into other languages; and will contain even more information about Versator than this README.md, including notes from all past and future releases.

**Versator is Back with Version 1.2.6!** 🥳

I'm excited to announce the release of Versator 1.2.6! This version marks the end of the "all-in-one" approach as I prepare for a more modular future with Reliverse CLI starting from version 1.3.0. The 1.2.6 release includes significant updates, especially in the database logic. The README.md has been significantly updated. Moving forward, I will introduce Canary, Release Candidate (RC), and General Availability (GA) branches for better version management. 1.2.6 will serve as a foundation, helping us transition more smoothly to the release of those 1.3.0's branches.

## Major Changes and Improvements (2)

- **Database Updates**: This is the last release that simultaneously supports PostgreSQL/MySQL and Auth.js (next-auth@beta/NextAuth.js)/Clerk integrations.
- **React 19 Preparation**: Work has commenced on upgrading from React 18 to React 19.
- **Updated Libraries**: The project now uses next-auth v5, clerk v5 and optionally supports tailwindcss v4. Refer to the updated README.md for more details.

## Migration Guidance (2)

Starting from version 1.3.1, I will provide comprehensive guides for migrating from older versions. The usual migration process involves reviewing commit changes and integrating necessary updates into your custom code. However, due to the extensive changes in versions 1.2.6 and 1.3.0, this method is not feasible. I recommend reinstalling the project and transferring your custom features from the previous version to the new version of starter. Thank you for your understanding!

To make the migration as smooth as possible, it's recommended to create a "`cluster`" folder in "`src`" and moving all your custom code there. If needed, you can adjust the paths using the [Find and Replace](https://code.visualstudio.com/docs/editor/codebasics#_search-and-replace) feature in VSCode. This will make it much easier to save and transfer your custom code to Versator 1.2.6.

## Default Database Change (2)

Neon PostgreSQL is now the default database instead of PlanetScale MySQL, as the latter no longer offers a free tier. If you require MySQL, [Railway](https://railway.app?referralCode=sATgpf) offers a more affordable alternative with a $5 credit without requiring a credit card. Note that this version has been primarily tested with Neon PostgreSQL.

## Security and Code Improvements (2)

- **Type Safety and Editor Autocomplete**: This update enhances type safety and editor autocomplete for Drizzle ORM libraries.
- **Prettier Replaced by Biome**: Prettier has been removed in favor of Biome. The Prettier config will be removed in the next version from the `addons\scripts\reliverse\relimter\core\temp` folder. You can re-add it by running the `reliverse` command starting from Versator 1.3.0.

## Reliverse Scripts Transition (2)

Reliverse scripts have moved from the "unknown viability" stage to the "unstable" stage. As always, use them at your own risk and make backups. These scripts are now located in the `addons/relimter/[core|python]` folder. Most scripts require Python to be installed.

For more details on this update, you can read my detailed posts in the Versator thread on Discord. Start with [this message](https://discord.com/channels/1075533942096150598/1155482425862922370/1241995095125786624).

## Thank You So Much

If anyone have any questions or issues, don't hesitate to contact me, means @blefnk, on Discord or GitHub. For more information about 1.2.6 and 1.3.0, please visit `#⭐-versator` chat on the project's Discord server and the [GitHub Issues](https://github.com/blefnk/versator/issues) page.

Thank you for your continued support and happy coding with [Reliverse Website Builder v0.4.0](https://github.com/blefnk/reliverse-website-builder) and [Versator Next.js Template v1.2.6](https://github.com/blefnk/versator)!

## Release Notes 1.2.5-1.0.0

**This is what happened before 1.2.6 version:**

<details>
  <summary>v1.2.5 — 27.02.2024</summary>

Hello! I, @blefnk Nazar Kornienko, finally have the opportunity to get back to working on Versator after a month of exams at university. Thanks to all the new starter users! The project already has over 520 stars, 110 forks, 20 repository watchers, and 45 users in Discord - that's really cool and exciting!

I also want to thank the active Discord users of the project: _codingisfun, el_ade, righthill, nyquanh, spacecoder315, adelinb_. Thank you to everyone who creates PR/Issues and everyone else who actively uses the starter, whose nicknames I don't know. Your feedback and contributions are incredibly valuable for the development of the project!

Since there hasn't been an update in over a month, I'm going to make the transition to the next major version smoother. Therefore, version 1.2.5 has been released to simply refresh the dependencies and other minor details and README a bit. This small update will also allow me to check if certain users continue to have the individual strange problems they reported.

If everything goes well, the next update will already be version 1.3.0. By the way, I'm working on 1.2.x and 1.3.0 in parallel, like in big studios, haha. But please note: some files and lines of code was disabled by default for this version to fix and check some things. By the way, the third digit means that this update is not mandatory, but still recommended. And Versator 1.3.0 may or may not come with a canary version of React/Next.js to start preparing for the upcoming release of React 19.

Well, that's all for today, all the best to everyone, and may your `bun latest` and `bun appts` always be successful! As usual, I try to write a short announcement, but it turns out a few paragraphs, that's how I live! 😄

P.S. And, please, don't pay attention that so many files have been "changed" in the latest commit, looks like it's because of Prettier I think, I only updated a few files, and if it's important to someone, please let me know in Discord's DM and I'll list you these files.

[Read more about v1.2.5](https://github.com/blefnk/versator/releases/edit/1.2.5)

</details>

<details>
  <summary>v1.2.4 — 13.01.2024</summary>

Just a small hotfix to improve the developer experience.

[Read more about 1.2.4](https://github.com/blefnk/versator/releases/edit/1.2.4)

</details>

<details>
  <summary>v1.2.3 — 12.01.2024</summary>

Just a small hotfix to improve the developer experience.

[Read more about 1.2.3](https://github.com/blefnk/versator/releases/edit/1.2.3)

</details>

<details>
  <summary>1.2.2 — 03.01.2024</summary>

1.2.2 brings ESLint Stylistic Plugin into the life. This will make the work with the project even more enjoyable.

Remember, Versator is designed to be beginner-friendly, so quite a lot of ESLint options are turned off, just turn on what you need.

These turn-offs will be gradually eliminated as I move towards the massive 2.0.0, which will significantly raise the project's standards, being professional, will be even more convenient for beginners.

[Read more about v1.2.2](https://github.com/blefnk/versator/releases/edit/1.2.2)

</details>

<details>
  <summary>1.2.1 — 02.01.2024</summary>

This is quite a small update compared to all the past ones, but this one also deserves the attention. Now, updates will generally be smaller but will appear more frequently. Thanks to this, it will be possible to easily update forks and independent projects that use Versator as their base.

Update v1.2.1 adds Chinese localization, and among other things, work has begun on the so-called token system, which will allow future versions to work with Figma design systems in an automated way. It will also help to make the styles in the project cleaner by significantly reducing the number of Tailwind classes. For this, Versator now installs the wonderful package @tokenami, developed by @jjenzz; Jenna, thank you so much for this library!

p.s. 1.2.1 is the first commit to the Versator repository that no longer contains an emoji at the beginning of its name. Thanks to this, contributors to Versator/Reliverse will no longer have to spend time inventing a suitable emoji.

[Read more about v1.2.1](https://github.com/blefnk/versator/releases/edit/1.2.1)

</details>

<details>
  <summary>1.2.0 — [27.12.2023] 🎄 Versator v1.2.0 is here! 🥳 Click to see the announcement 🎁</summary>

_Versator 1.2.0 is already here! I, [@blefnk Nazar Kornienko](https://github.com/blefnk), am thrilled to wrap up this year 2023, proudly presenting this release to the OSS community! So, the result of over two months of hard work is finally here!_

In this version, significant attention was focused on stability, security, performance optimization, and a substantial improvements in design—both visually, UX, and the logic of how the app works. A lot was really done, too much to list everything! Be sure to install it and check it out!

By the way, you can now enjoy a finely-tuned ESLint Flat Config! Also, it's worth noting that Clerk, since version 1.1.0, is no longer considered deprecated in the Versator project. Thanks to 1.2.0, Clerk now works seamlessly with an easy switch to Auth.js (next-auth@beta/NextAuth.js) when needed, all on the fly. Plus, full support for Turbopack (next dev --turbo) is finally here, even for next-intl!

As for next-intl, finally, I can now enjoy internationalization that works not only on the client-side but also on the server! Only the 404 page has client-side i18n messages, all other pages and components use i18n as server-first. And this is really cool!

Many unique solutions have been implemented in this new version. Moreover, using Versator from this version, you have the opportunity to try out the alpha version of my unique Code-First/No-Code Builder system for React pages and components (which will appear in Reliverse CMS in the future). Just visit the Admin page while in the development environment and enjoy.

If you have already used Versator before, please pay attention, this is very important! Be sure to check the updated .env.example file and update the .env file accordingly.

As a small teaser/spoiler, for Versator 1.3.0, even more improvements in visual design and UX are planned; 1.4.0 will come with a magical CLI implementation, allowing you to quickly obtain only the necessary features and dependencies for the app (even automated updates and the ability to add other functions and packages to an already installed app); 1.5.0 will undergo a full code refactoring that will meet all the best standards and practices. It's going to be incredible!

So, install this new version of Versator 1.2.0 and appreciate the multitude of incredible features, and freely use it in the own projects today. Please use the preferred feedback channels to share the thoughts on Versator 1.2.0 and what you would like to see in future releases.

Don't forget to also check out the significantly updated README.md, it's worth it.

Enjoy! ❄️☃️ Merry Christmas and Happy New Year 2024! 🎇🥳

</details>

<details>
  <summary>1.1.0 — 🔥 The Most Feature-Rich Next.js 15 Starter</summary>

Here it is! Versator has been updated to version 1.1.0!

**Now it's even more feature-rich, with cleaner code, and a more stable Next.js starter.**

Ever dreamed of having both MySQL/PostgreSQL and Clerk/Auth.js (next-auth@beta/NextAuth.js) in one project with the ability to switch on the fly? And even if you hadn't thought about it – now it's possible. Mix and match at will – even more possibilities for on-the-fly switching are coming soon in the next releases of Versator.

Among many other new and fixed things, Stripe is now fully functional and comes with extensive docs in the form of comments within the relevant files.

`Please star this repository` to show the support! Thank you to everyone who has shown interest in this project!

Please check out the updated list of project features in the project's README. Enjoy and please share the feedback!

[Read more about v1.1.0](https://github.com/blefnk/versator/releases/edit/1.1.0)

</details>

<details>
  <summary>1.0.0 — 🎉 Versator Release</summary>

How to Install and Get Started? Please refer to the [🏗️ Installation](./INSTALLATION.md) section, where you can always find information about the project and how to install it easily.

[Read more about v1.0.0](https://github.com/blefnk/versator/releases/tag/1.0.0)

</details>

Please visit the [CHANGELOG.md](.github/CHANGELOG.md) or [Reliverse Docs](https://reliverse.org/versator) to read the release notes for older versions.

## Further Reading

- [v0.1.0-v0.9.0](https://github.com/blefnk/versator/releases?page=2)
- [v1.0.0-v1.2.5](https://github.com/blefnk/versator/blob/main/.github/CHANGELOG.md)
- [1.2.6 – The Resurrection Update - August 4](./v126)
- [v1.3.0 (canary)](./v130)
