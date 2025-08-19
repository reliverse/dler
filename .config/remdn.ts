import type { ConfigRemdn } from "~/impl/remdn/cmd";

const config: ConfigRemdn = {
  title: "Directory Comparison",
  output: "docs/files.html",
  dirs: {
    src: {},
    "dist-npm/bin": {},
    "dist-jsr/bin": {},
    "dist-libs/sdk/npm/bin": {},
  },
  "ext-map": {
    ts: ["ts", "js-d.ts", "ts"], // [<main>, <dist-npm/bin | dist-libs's * npm/bin>, <dist-jsr | dist-libs's * jsr/bin>]
  },
};

export default config;
