import { FixDtsDefaultCjsExportsPlugin } from "fix-dts-default-cjs-exports/rollup";
import MagicString from "magic-string";
import { findStaticImports } from "mlly";
import type { Plugin, SourceMapInput } from "rollup";

import type { BuildContext } from "~/app/types/mod";

export function cjsPlugin(): Plugin {
  return {
    name: "dler-cjs",
    renderChunk(code, _chunk, opts) {
      if (opts.format === "es") {
        const result = CJSToESM(code);
        return result || null;
      }
      return null;
    },
  };
}

export function fixCJSExportTypePlugin(ctx: BuildContext): Plugin {
  const regexp =
    ctx.options.declaration === "node16"
      ? /\.d\.cts$/ // d.cts only
      : /\.d\.c?ts$/; // d.ts and d.cts
  return FixDtsDefaultCjsExportsPlugin({
    matcher: (info) => {
      return (
        info.type === "chunk" &&
        info.exports?.length > 0 &&
        info.exports.includes("default") &&
        regexp.test(info.fileName) &&
        info.isEntry
      );
    },
    warn: (msg) => ctx.warnings.add(msg),
  }) as Plugin;
}

const CJSyntaxRe = /__filename|__dirname|require\(|require\.resolve\(/;

const CJSShim = `

// -- dler CommonJS Shims --
import __cjs_url__ from 'url';
import __cjs_path__ from 'path';
import __cjs_mod__ from 'module';
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require = __cjs_mod__.createRequire(import.meta.url);
`;

// Shim __dirname, __filename and require
function CJSToESM(code: string): null | { code: string; map: SourceMapInput } {
  if (code.includes(CJSShim) || !CJSyntaxRe.test(code)) {
    return null;
  }

  const lastESMImport = findStaticImports(code).pop();
  const indexToAppend = lastESMImport ? lastESMImport.end : 0;
  const s = new MagicString(code);
  s.appendRight(indexToAppend, CJSShim);

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }) as SourceMapInput,
  };
}
