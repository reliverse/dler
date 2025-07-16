import { normalize } from "@reliverse/pathkit";

import type { DetectPackageManagerOptions, PackageManagerName } from "./pm-types";

export async function findup<T>(
  cwd: string,
  match: (path: string) => T | Promise<T>,
  options: Pick<DetectPackageManagerOptions, "includeParentDirs"> = {},
): Promise<T | undefined> {
  const segments = normalize(cwd).split("/");

  while (segments.length > 0) {
    const path = segments.join("/") || "/";
    const result = await match(path);

    if (result || !options.includeParentDirs) {
      return result;
    }

    segments.pop();
  }
}

export function parsePackageManagerField(packageManager?: string): {
  name?: PackageManagerName;
  version?: string;
  buildMeta?: string;
  warnings?: string[];
} {
  const [name, _version] = (packageManager || "").split("@");
  const [version, buildMeta] = _version?.split("+") || [];

  if (name && name !== "-" && /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return { name: name as PackageManagerName, version, buildMeta };
  }

  const sanitized = name?.replace(/\W+/g, "") || "";
  const warnings = [
    `Abnormal characters found in \`packageManager\` field, sanitizing from \`${name}\` to \`${sanitized}\``,
  ];
  return {
    name: sanitized as PackageManagerName,
    version,
    buildMeta,
    warnings,
  };
}
