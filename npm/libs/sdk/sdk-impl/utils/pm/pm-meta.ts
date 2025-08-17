import ky from "ky";
import registryAuthToken from "registry-auth-token";
import registryUrl from "registry-url";
import semver from "semver";

interface PackageJsonOptions {
  version?: string;
  omitDeprecated?: boolean;
  registryUrl?: string;
  fullMetadata?: boolean;
  allVersions?: boolean;
}

interface PackageData {
  "dist-tags": Record<string, string>;
  versions: Record<string, PackageVersion>;
  time?: Record<string, string>;
}

interface PackageVersion {
  version: string;
  deprecated?: boolean;
  time?: Record<string, string>;
  [key: string]: any;
}

interface AuthInfo {
  type: string;
  token: string;
}

export class PackageNotFoundError extends Error {
  constructor(packageName: string) {
    super(`Package \`${packageName}\` could not be found`);
    this.name = "PackageNotFoundError";
  }
}

export class VersionNotFoundError extends Error {
  constructor(packageName: string, version: string) {
    super(`Version \`${version}\` for package \`${packageName}\` could not be found`);
    this.name = "VersionNotFoundError";
  }
}

export async function pmPackageJson(
  packageName: string,
  options: PackageJsonOptions = {},
): Promise<PackageData | PackageVersion> {
  let { version = "latest" } = options;
  const { omitDeprecated = true } = options;

  const scope = packageName.split("/")[0];
  const registryUrl_ = options.registryUrl ?? registryUrl(scope);
  const packageUrl = new URL(encodeURIComponent(packageName).replace(/^%40/, "@"), registryUrl_);
  const authInfo = registryAuthToken(registryUrl_.toString(), { recursive: true }) as
    | AuthInfo
    | undefined;

  const headers: Record<string, string> = {
    accept: "application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*",
  };

  if (options.fullMetadata) {
    headers.accept = "";
  }

  if (authInfo) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
  }

  let data: PackageData;
  try {
    data = await ky(packageUrl, { headers, keepalive: true }).json<PackageData>();
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new PackageNotFoundError(packageName);
    }

    throw error;
  }

  if (options.allVersions) {
    return data;
  }

  const versionError = new VersionNotFoundError(packageName, version);

  if (version && data["dist-tags"][version]) {
    const { time } = data;
    const versionTag = data["dist-tags"][version];
    if (versionTag) {
      const packageVersion = data.versions[versionTag];
      if (packageVersion) {
        packageVersion.time = time;
        return packageVersion;
      }
    }
  } else if (version) {
    const versionExists = Boolean(data.versions[version]);

    if (omitDeprecated && !versionExists) {
      for (const [metadataVersion, metadata] of Object.entries(data.versions)) {
        if (metadata.deprecated) {
          delete data.versions[metadataVersion];
        }
      }
    }

    if (!versionExists) {
      const versions = Object.keys(data.versions);
      const resolvedVersion = semver.maxSatisfying(versions, version);

      if (!resolvedVersion) {
        throw versionError;
      }

      version = resolvedVersion;
    }

    const { time } = data;
    const packageVersion = data.versions[version];

    if (!packageVersion) {
      throw versionError;
    }

    packageVersion.time = time;
    return packageVersion;
  }

  throw versionError;
}

export async function latestVersion(packageName: string, options: PackageJsonOptions = {}) {
  const { version } = (await pmPackageJson(packageName.toLowerCase(), options)) as PackageVersion;
  return version;
}

// Some parts of this file are based on and significantly adapt:
// - https://github.com/sindresorhus/package-json/tree/a918258 – MIT © Sindre Sorhus (sindresorhus)
// - https://github.com/sindresorhus/latest-version/tree/e550aac – MIT © Sindre Sorhus (sindresorhus)
