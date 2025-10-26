import type { ReleaseType } from "semver";

export type BumpType = ReleaseType | "prerelease";

export interface VersionInfo {
  current: string;
  bumped: string;
  type: BumpType;
}
