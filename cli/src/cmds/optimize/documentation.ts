// cli/src/cmds/optimize/documentation.ts

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "@reliverse/relinka";
import type { ImprovementMetadata, PackageEntry } from "./types";

const DOCS_PATH = resolve(process.cwd(), ".reliverse", "optimizations.md");

export async function getCurrentTimestamp(): Promise<string> {
  // Use PowerShell to get CET timestamp
  try {
    const proc = Bun.spawn(
      [
        "pwsh",
        "-Command",
        '[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date).ToUniversalTime(), "Central European Standard Time").ToString("yyyy-MM-dd HH:mm:ss")',
      ],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0) {
      return stdout.trim();
    }
  } catch {
    // Fallback to UTC if PowerShell fails
  }

  // Fallback to UTC if PowerShell fails
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export async function loadDocumentation(): Promise<PackageEntry> {
  if (!existsSync(DOCS_PATH)) {
    return {};
  }

  try {
    const content = readFileSync(DOCS_PATH, "utf-8");
    return parseDocumentation(content);
  } catch (error) {
    logger.warn(`Failed to load documentation: ${error}`);
    return {};
  }
}

export async function updateDocumentation(
  packageName: string,
  metadata: ImprovementMetadata,
  changelogEntry?: string,
): Promise<void> {
  const docs = await loadDocumentation();

  if (!docs[packageName]) {
    docs[packageName] = {
      last_updated: metadata.last_updated,
      improvement_type: metadata.improvement_type,
      description: metadata.description,
      outcome: metadata.outcome,
      regression_notes: metadata.regression_notes,
      changelog: [],
    };
  } else {
    docs[packageName].last_updated = metadata.last_updated;
    docs[packageName].improvement_type = metadata.improvement_type;
    docs[packageName].description = metadata.description;
    docs[packageName].outcome = metadata.outcome;
    docs[packageName].regression_notes = metadata.regression_notes;
  }

  if (changelogEntry && docs[packageName].changelog) {
    docs[packageName].changelog.unshift(changelogEntry);
    // Keep only last 10 entries
    if (docs[packageName].changelog.length > 10) {
      docs[packageName].changelog = docs[packageName].changelog.slice(0, 10);
    }
  }

  await saveDocumentation(docs);
}

async function saveDocumentation(docs: PackageEntry): Promise<void> {
  // Ensure directory exists
  const dir = resolve(DOCS_PATH, "..");
  if (!existsSync(dir)) {
    const { mkdirp } = await import("@reliverse/relifso");
    await mkdirp(dir);
  }

  const content = formatDocumentation(docs);
  writeFileSync(DOCS_PATH, content, "utf-8");
}

function parseDocumentation(content: string): PackageEntry {
  const docs: PackageEntry = {};
  const lines = content.split("\n");

  let currentPackage: string | null = null;
  let inChangelog = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith("@reliverse/")) {
      currentPackage = line.replace(":", "").trim();
      if (currentPackage) {
        docs[currentPackage] = {
          last_updated: "",
          improvement_type: "",
          description: "",
          outcome: "",
          regression_notes: "",
          changelog: [],
        };
      }
      inChangelog = false;
    } else if (currentPackage) {
      const entry = docs[currentPackage];
      if (!entry) {
        continue;
      }

      if (line.startsWith("last_updated:")) {
        entry.last_updated = line.split(":")[1]?.trim() ?? "";
      } else if (line.startsWith("improvement_type:")) {
        entry.improvement_type = line.split(":")[1]?.trim() ?? "";
      } else if (line.startsWith("description:")) {
        entry.description = line.split(":")[1]?.trim() ?? "";
      } else if (line.startsWith("outcome:")) {
        entry.outcome = line.split(":")[1]?.trim() ?? "";
      } else if (line.startsWith("regression_notes:")) {
        entry.regression_notes = line.split(":")[1]?.trim() ?? "";
      } else if (line === "changelog:") {
        inChangelog = true;
      } else if (inChangelog && line.startsWith("-")) {
        entry.changelog?.push(line.substring(1).trim());
      }
    }
  }

  return docs;
}

function formatDocumentation(docs: PackageEntry): string {
  let content = "# Reliverse Package Optimizations\n\n";
  content +=
    "This file tracks performance and build-related improvements for @reliverse/* packages.\n\n";
  content += "---\n\n";

  const sortedPackages = Object.keys(docs).sort();

  for (const packageName of sortedPackages) {
    const entry = docs[packageName];
    if (!entry) {
      continue;
    }

    content += `## ${packageName}\n\n`;
    content += `**Last Updated:** ${entry.last_updated}\n\n`;
    content += `**Improvement Type:** ${entry.improvement_type}\n\n`;
    content += `**Description:** ${entry.description}\n\n`;
    content += `**Outcome:** ${entry.outcome}\n\n`;
    content += `**Regression Notes:** ${entry.regression_notes}\n\n`;

    if (entry.changelog && entry.changelog.length > 0) {
      content += `### Changelog\n\n`;
      for (const change of entry.changelog) {
        content += `- ${change}\n`;
      }
      content += "\n";
    }

    content += "---\n\n";
  }

  return content;
}
