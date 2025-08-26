/* ------------------------------------------------------------------
 * Default Config and Merging Logic
 * ------------------------------------------------------------------
 */

import type { ProjectFramework } from "~/app/types/mod";

export const PROJECT_FRAMEWORK_FILES: Record<ProjectFramework, string[]> = {
  unknown: [],
  nextjs: ["next.config.js", "next.config.ts", "next.config.mjs"],
  vite: ["vite.config.js", "vite.config.ts", "react.config.js"],
  svelte: ["svelte.config.js", "svelte.config.ts"],
  remix: ["remix.config.js", "remix.config.ts"],
  astro: ["astro.config.js", "astro.config.ts", "astro.config.mjs"],
  nuxt: ["nuxt.config.js", "nuxt.config.ts"],
  solid: ["solid.config.js", "solid.config.ts"],
  qwik: ["qwik.config.js", "qwik.config.ts"],
  "react-native": ["App.js", "App.tsx", "App.ts"],
  expo: ["app.json", "app.config.js"],
  capacitor: ["capacitor.config.ts", "capacitor.config.json"],
  ionic: ["ionic.config.json"],
  electron: ["electron.config.js", "electron.config.ts"],
  tauri: ["tauri.conf.json"],
  neutralino: ["neutralino.config.json"],
  rempts: ["package.json:@reliverse/rempts"],
  citty: ["package.json:citty"],
  commander: ["package.json:commander"],
  cac: ["package.json:cac"],
  meow: ["package.json:meow"],
  yargs: ["package.json:yargs"],
  vscode: ["vscode.config.js", "vscode.config.ts"],
  webextension: ["manifest.json"],
  "browser-extension": ["manifest.json"],
  "npm-jsr": ["jsr.json", "jsr.jsonc"],
  lynx: ["App.tsx", "App.css"],
  vue: ["vue.config.js", "vite.config.ts"],
  wxt: ["wxt.config.js", "wxt.config.ts"],
};
