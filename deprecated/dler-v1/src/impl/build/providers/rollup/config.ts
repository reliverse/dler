import { isAbsolute, resolve, resolveAlias } from "@reliverse/pathkit";
import { parseNodeModulePath } from "mlly";
import type { OutputOptions, PreRenderedChunk } from "rollup";
import { arrayIncludes, getpkg, warn } from "~/impl/build/providers/utils";
import type { BuildContext, RollupOptions } from "~/impl/types/mod";

import { cjsPlugin } from "./plugins/cjs";
import { esbuild } from "./plugins/esbuild";
import { JSONPlugin } from "./plugins/json";
import { rawPlugin } from "./plugins/raw";
import { shebangPlugin } from "./plugins/shebang";
import { DEFAULT_EXTENSIONS, getChunkFilename, resolveAliases } from "./utils";

const replaceModule = (await import("@rollup/plugin-replace")) as any;
const replace = replaceModule.default || replaceModule;

const aliasModule = (await import("@rollup/plugin-alias")) as any;
const alias = aliasModule.default || aliasModule;

const commonjsModule = (await import("@rollup/plugin-commonjs")) as any;
const commonjs = commonjsModule.default || commonjsModule;

const nodeResolveModule = (await import("@rollup/plugin-node-resolve")) as any;
const nodeResolve =
	nodeResolveModule.nodeResolve ||
	nodeResolveModule.default ||
	nodeResolveModule;

export function getRollupOptions(ctx: BuildContext): RollupOptions {
	const _aliases = resolveAliases(ctx);
	return {
		external(originalId): boolean {
			// Resolve aliases
			const resolvedId = resolveAlias(originalId, _aliases);

			// Try to guess package name of id
			const pkgName =
				parseNodeModulePath(resolvedId)?.name ||
				parseNodeModulePath(originalId)?.name ||
				getpkg(originalId);

			// Check for explicit external rules
			if (
				arrayIncludes(ctx.options.externals, pkgName) ||
				arrayIncludes(ctx.options.externals, originalId) ||
				arrayIncludes(ctx.options.externals, resolvedId)
			) {
				return true;
			}

			// Source is always bundled
			for (const id of [originalId, resolvedId]) {
				if (
					id.startsWith(".") ||
					isAbsolute(id) ||
					/src[/\\]/.test(id) ||
					(ctx.pkg.name && id.startsWith(ctx.pkg.name))
				) {
					return false;
				}
			}

			// Check for other explicit inline rules
			if (
				ctx.options.rollup.inlineDependencies === true ||
				(Array.isArray(ctx.options.rollup.inlineDependencies) &&
					(arrayIncludes(ctx.options.rollup.inlineDependencies, pkgName) ||
						arrayIncludes(ctx.options.rollup.inlineDependencies, originalId) ||
						arrayIncludes(ctx.options.rollup.inlineDependencies, resolvedId)))
			) {
				return false;
			}

			// Inline by default, but also show a warning, since it is an implicit behavior
			warn(ctx, `Implicitly bundling "${originalId}"`);
			return false;
		},

		input: Object.fromEntries(
			ctx.options.entries
				.filter((entry) => entry.builder === "rollup")
				.map((entry) => [
					entry.name,
					resolve(ctx.options.rootDir, entry.input),
				]),
		),

		onwarn(warning, rollupWarn): void {
			if (!warning.code || !["CIRCULAR_DEPENDENCY"].includes(warning.code)) {
				rollupWarn(warning);
			}
		},

		output: [
			ctx.options.rollup.emitCJS &&
				({
					chunkFileNames: (chunk: PreRenderedChunk) =>
						getChunkFilename(ctx, chunk, "cjs"),
					dir: resolve(ctx.options.rootDir, ctx.options.outDir),
					entryFileNames: "[name].cjs",
					exports: "auto",
					externalLiveBindings: false,
					format: "cjs",
					freeze: false,
					generatedCode: { constBindings: true },
					interop: "compat",
					sourcemap: ctx.options.transpileSourcemap,
					...ctx.options.rollup.output,
				} satisfies OutputOptions),
			{
				chunkFileNames: (chunk: PreRenderedChunk) =>
					getChunkFilename(ctx, chunk, "mjs"),
				dir: resolve(ctx.options.rootDir, ctx.options.outDir),
				entryFileNames: "[name].mjs",
				exports: "auto",
				externalLiveBindings: false,
				format: "esm",
				freeze: false,
				generatedCode: { constBindings: true },
				sourcemap: ctx.options.transpileSourcemap,
				...ctx.options.rollup.output,
			} satisfies OutputOptions,
		].filter(Boolean) as OutputOptions[],

		plugins: [
			ctx.options.rollup.replace &&
				replace({
					...ctx.options.rollup.replace,
					values: {
						...ctx.options.replace,
						...ctx.options.rollup.replace.values,
					},
				}),

			ctx.options.rollup.alias &&
				alias({
					...ctx.options.rollup.alias,
					entries: _aliases,
				}),

			ctx.options.rollup.resolve &&
				nodeResolve({
					exportConditions: ["production"],
					extensions: DEFAULT_EXTENSIONS,
					...ctx.options.rollup.resolve,
				}),

			ctx.options.rollup.json &&
				JSONPlugin({
					...ctx.options.rollup.json,
				}),

			shebangPlugin(),

			ctx.options.rollup.esbuild &&
				esbuild({
					sourcemap: ctx.options.transpileSourcemap,
					...ctx.options.rollup.esbuild,
				}),

			ctx.options.rollup.commonjs &&
				commonjs({
					extensions: DEFAULT_EXTENSIONS,
					...ctx.options.rollup.commonjs,
				}),

			ctx.options.rollup.preserveDynamicImports && {
				name: "dler=preserve-dynamic-imports",
				renderDynamicImport(): { left: string; right: string } {
					return { left: "import(", right: ")" };
				},
			},

			ctx.options.rollup.cjsBridge && cjsPlugin(),

			rawPlugin(),
		].filter((p): p is NonNullable<Exclude<typeof p, false>> => !!p),
	} satisfies RollupOptions;
}
