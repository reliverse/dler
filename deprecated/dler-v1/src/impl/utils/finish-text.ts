import prettyMilliseconds from "pretty-ms";
import { PROJECT_ROOT } from "~/impl/config/constants";
import { getPackageJson } from "~/impl/config/detect";
import type { ReliverseConfig } from "../schema/mod";
import type { PerfTimer } from "../types/mod";
import { getElapsedPerfTime } from "../utils/utils-perf";

export async function createCompletionTexts(
  buildConfig: ReliverseConfig,
  timer: PerfTimer,
  action: "build" | "publish",
): Promise<{ plain: string; withEmoji: string }> {
  const elapsedTime = getElapsedPerfTime(timer);
  const formattedPerfTime = prettyMilliseconds(elapsedTime, { verbose: true });

  const pkgJson = await getPackageJson(PROJECT_ROOT);
  const packageName = pkgJson?.name ?? buildConfig.projectName ?? "The project";
  const versionFromPkg = pkgJson?.version;
  const versionLabelMain =
    (versionFromPkg ?? buildConfig.version)
      ? ` v${(versionFromPkg ?? buildConfig.version) as string}`
      : "";

  const includeLibs =
    buildConfig.libsActMode === "libs-only" || buildConfig.libsActMode === "main-and-libs";

  const namesForAction = (() => {
    if (!includeLibs) return [] as string[];
    const entries = Object.entries(buildConfig.libsList ?? {});
    const names = [] as string[];
    for (const [libName, libCfg] of entries) {
      if (action === "publish") {
        if (buildConfig.commonPubPause || libCfg?.libPubPause) continue;
      }
      const libVersionLabel = libCfg?.version ? ` v${libCfg.version}` : versionLabelMain;
      names.push(`${libName}${libVersionLabel}`);
    }
    return names;
  })();

  const displayName =
    namesForAction.length > 0 ? namesForAction.join(", ") : `${packageName}${versionLabelMain}`;

  const publishTargetLabel = (() => {
    switch (buildConfig.commonPubRegistry) {
      case "npm":
        return "to NPM";
      case "jsr":
        return "to JSR";
      case "npm-jsr":
        return "to NPM and JSR";
      default:
        return "to NPM and JSR";
    }
  })();

  const base =
    action === "build"
      ? `${displayName} build completed successfully in ${formattedPerfTime}`
      : `${displayName} publish ${publishTargetLabel} completed successfully in ${formattedPerfTime}`;

  return { plain: base, withEmoji: `✅ ${base}` };
}
