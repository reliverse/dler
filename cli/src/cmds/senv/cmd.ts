// dler senv command. Examples:
// - `dler senv --action append --name Path --value C:\Users\your-user-name\.local\bin`

import {
  defineCmd,
  defineCmdArgs,
  defineCmdCfg,
} from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import fs from "fs/promises";

const isWindows = (): boolean =>
  (globalThis as any).Bun?.platform?.() === "win32" ||
  process.platform === "win32";

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
};

const normalizePathEntries = (raw: string): string[] => {
  const sep = isWindows() ? ";" : ":";
  return raw
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
};

const joinPathEntries = (entries: string[]): string =>
  isWindows() ? entries.join(";") : entries.join(":");

const normalizeEntry = (entry: string): string => {
  const trimmed = entry.trim();
  if (isWindows()) {
    return trimmed.replaceAll("/", "\\");
  }
  return trimmed;
};

const toComparable = (entry: string): string => {
  const normalized = normalizeEntry(entry);
  return isWindows() ? normalized.toLowerCase() : normalized;
};

const uniqueByComparable = (entries: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const e of entries) {
    const key = toComparable(e);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e); // Use original entry, already normalized by caller
    }
  }
  return result;
};

const backupFile = async (path: string): Promise<void> => {
  try {
    if (!(await fileExists(path))) return;
    // Use timestamp + random suffix to prevent collisions
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const random = Math.random().toString(36).substring(2, 8);
    const bak = `${path}.bak.${now}.${random}`;
    await fs.copyFile(path, bak);
    logger.info(`Backup created: ${bak}`);
  } catch (error) {
    logger.warn(`Failed to create backup for ${path}: ${error}`);
  }
};

// Escape PowerShell string literals
const escapePowerShellString = (str: string): string => {
  return str.replace(/'/g, "''");
};

const runPowerShellGetUser = async (name: string): Promise<string> => {
  const safeName = escapePowerShellString(name);
  const command = `[Environment]::GetEnvironmentVariable('${safeName}', 'User')`;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const text = await new Response(proc.stdout).text();
  await proc.exited;
  return text.trim();
};

const runPowerShellSetUser = async (
  name: string,
  value: string,
): Promise<void> => {
  const safeName = escapePowerShellString(name);
  const safeValue = escapePowerShellString(value);
  const command = `[Environment]::SetEnvironmentVariable('${safeName}', '${safeValue}', 'User')`;

  const proc = Bun.spawn(["powershell", "-NoProfile", "-Command", command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`PowerShell command failed: ${stderr}`);
  }
};

const getHomeDirectory = (): string => {
  if (isWindows()) {
    return process.env.USERPROFILE || process.env.HOME || "";
  }
  return process.env.HOME || "";
};

const persistPosix = async (name: string, value: string): Promise<void> => {
  const home = getHomeDirectory();
  if (!home) {
    throw new Error("Could not determine home directory");
  }

  const profile = `${home}/.profile`;
  // Escape regex special characters in variable name
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*export\\s+${escapedName}=.*$`, "m");

  try {
    const exists = await fileExists(profile);

    if (!exists) {
      await fs.writeFile(
        profile,
        `# created by dler senv\nexport ${name}="${value}"\n`,
      );
      logger.info(`Wrote new ${profile}`);
      return;
    }

    await backupFile(profile);
    const content = await fs.readFile(profile, "utf8");

    const newContent = re.test(content)
      ? content.replace(re, `export ${name}="${value}"`)
      : content + `\n# added by dler senv\nexport ${name}="${value}"\n`;

    await fs.writeFile(profile, newContent);
    logger.info(`Updated ${profile}`);
  } catch (e) {
    logger.error("Failed to persist to ~/.profile:");
    logger.error(String(e));
    throw e;
  }
};

const persistPosixEditPath = async (
  name: string,
  entry: string,
  action: "append" | "remove",
): Promise<void> => {
  const home = getHomeDirectory();
  if (!home) {
    throw new Error("Could not determine home directory");
  }

  const profile = `${home}/.profile`;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s*export\\s+${escapedName}=["']?(.*)["']?$`, "m");

  await backupFile(profile);

  const exists = await fileExists(profile);
  const content = exists ? await fs.readFile(profile, "utf8") : "";

  const match = content.match(re);
  const current = match ? match[1] : process.env[name] || "";

  // Single pass normalization
  let entries = normalizePathEntries(current || "").map(normalizeEntry);
  const normalizedEntry = normalizeEntry(entry);

  if (action === "append") {
    const set = new Set(entries.map(toComparable));
    if (!set.has(toComparable(normalizedEntry))) {
      entries.push(normalizedEntry);
    }
  } else {
    const targetKey = toComparable(normalizedEntry);
    const idx = entries.findIndex((e) => toComparable(e) === targetKey);
    if (idx >= 0) entries.splice(idx, 1);
  }

  entries = uniqueByComparable(entries);
  const newVal = joinPathEntries(entries);

  const next = re.test(content)
    ? content.replace(re, `export ${name}="${newVal}"`)
    : content + `\n# added by dler senv\nexport ${name}="${newVal}"\n`;

  await fs.writeFile(profile, next);
  logger.info(`Persisted ${name} in ${profile}`);
};

const senvCmdArgs = defineCmdArgs({
  action: {
    type: "string",
    required: true,
    description: "Operation to perform: list|get|set|append|remove|contains",
  },
  name: {
    type: "string",
    description: "Environment variable name (optional for list)",
  },
  value: {
    type: "string",
    description: "Value for set/append/remove/contains",
  },
  persist: {
    type: "boolean",
    description: "Persist change to user environment (default: true)",
  },
  yes: {
    type: "boolean",
    description: "Skip interactive confirmation message",
  },
});

const senvCmdCfg = defineCmdCfg({
  name: "senv",
  description:
    "Inspect and modify environment variables (process and user-level)",
  examples: [
    "dler senv --action list",
    "dler senv --action list --name Path",
    "dler senv --action get --name Path",
    "dler senv --action set --name Path --value C\\\\bin",
    "dler senv --action append --name Path --value C\\\\msys64\\\\ucrt64\\\\bin --yes",
    "dler senv --action contains --name Path --value C\\\\bin",
  ],
});

const senvCmd = async (args: {
  action: string;
  name?: string;
  value?: string;
  persist?: boolean;
  yes?: boolean;
}): Promise<void> => {
  try {
    if (typeof process.versions.bun === "undefined") {
      logger.error("❌ This command requires Bun runtime. Sorry.");
      process.exit(1);
    }

    const { action, name, value } = args;
    const persist = args.persist ?? true;
    const yes = args.yes ?? false;

    const allowed = new Set([
      "list",
      "get",
      "set",
      "append",
      "remove",
      "contains",
    ]);
    if (!allowed.has(action)) {
      logger.error(
        "Unknown action. Allowed: list, get, set, append, remove, contains",
      );
      process.exit(2);
    }

    if (action === "list") {
      if (name) {
        logger.log(`${name}=${process.env[name] ?? ""}`);
      } else {
        for (const k of Object.keys(process.env).sort()) {
          logger.log(`${k}=${process.env[k]}`);
        }
      }
      return;
    }

    if (!name) {
      logger.error("Name is required for this action");
      process.exit(2);
    }

    if (action === "get") {
      logger.log(process.env[name] ?? "");
      return;
    }

    if (action === "contains") {
      if (!value) {
        logger.error("Value required for contains");
        process.exit(2);
      }
      const cur = process.env[name] ?? "";
      const entries = normalizePathEntries(cur).map(normalizeEntry);
      const keys = new Set(entries.map(toComparable));
      process.exit(keys.has(toComparable(value)) ? 0 : 1);
    }

    if (action === "set") {
      if (typeof value === "undefined") {
        logger.error("Value required for set");
        process.exit(2);
      }
      process.env[name] = value;
      logger.info(`Set ${name} for current process.`);

      if (persist) {
        if (!yes) {
          logger.info(
            "Persisting to user environment (will create backup). Use --yes to skip this message.",
          );
        }

        if (isWindows()) {
          try {
            await runPowerShellSetUser(name, value);
            logger.success(`Persisted ${name} to User environment (Windows).`);
          } catch (e) {
            logger.error("Failed to persist via PowerShell:");
            logger.error(String(e));
          }
        } else {
          try {
            await persistPosix(name, value);
          } catch (e) {
            logger.error("Failed to persist on POSIX:");
            logger.error(String(e));
          }
        }
      }
      return;
    }

    if (!value) {
      logger.error("Value required for append/remove");
      process.exit(2);
    }

    const cur = process.env[name] ?? "";
    const normalizedValue = normalizeEntry(value);
    let entries = normalizePathEntries(cur).map(normalizeEntry);

    if (action === "append") {
      const keySet = new Set(entries.map(toComparable));
      const targetKey = toComparable(normalizedValue);

      if (keySet.has(targetKey)) {
        logger.info("Entry already present — nothing to do.");
      } else {
        entries.push(normalizedValue);
        entries = uniqueByComparable(entries);
        const newVal = joinPathEntries(entries);
        process.env[name] = newVal;
        logger.info(`Appended to ${name} for current process.`);

        if (persist) {
          if (isWindows()) {
            try {
              const userVal = (await runPowerShellGetUser(name)).trim();
              const userEntries = normalizePathEntries(userVal || "").map(
                normalizeEntry,
              );
              const uSet = new Set(userEntries.map(toComparable));

              if (!uSet.has(targetKey)) {
                userEntries.push(normalizedValue);
                const uniqueEntries = uniqueByComparable(userEntries);
                const joined = joinPathEntries(uniqueEntries);
                await runPowerShellSetUser(name, joined);
                logger.success(`Persisted append to User ${name} (Windows).`);
              } else {
                logger.info(
                  "User-level already contains the entry — no change.",
                );
              }
            } catch (e) {
              logger.error("Failed to persist append on Windows:");
              logger.error(String(e));
            }
          } else {
            try {
              await persistPosixEditPath(name, value, "append");
            } catch (e) {
              logger.error("Failed to persist append on POSIX:");
              logger.error(String(e));
            }
          }
        }
      }
      return;
    }

    if (action === "remove") {
      const targetKey = toComparable(normalizedValue);
      const idx = entries.findIndex((e) => toComparable(e) === targetKey);

      if (idx === -1) {
        logger.info("Entry not present — nothing to remove.");
      } else {
        entries.splice(idx, 1);
        entries = uniqueByComparable(entries);
        const newVal = joinPathEntries(entries);
        process.env[name] = newVal;
        logger.info(`Removed entry from ${name} for current process.`);

        if (persist) {
          if (isWindows()) {
            try {
              const userVal = (await runPowerShellGetUser(name)).trim();
              const userEntries = normalizePathEntries(userVal || "").map(
                normalizeEntry,
              );
              const i2 = userEntries.findIndex(
                (e) => toComparable(e) === targetKey,
              );

              if (i2 >= 0) {
                userEntries.splice(i2, 1);
                const uniqueEntries = uniqueByComparable(userEntries);
                await runPowerShellSetUser(
                  name,
                  joinPathEntries(uniqueEntries),
                );
                logger.success(`Persisted removal to User ${name} (Windows).`);
              } else {
                logger.info("User-level did not contain entry — no change.");
              }
            } catch (e) {
              logger.error("Failed to persist removal on Windows:");
              logger.error(String(e));
            }
          } else {
            try {
              await persistPosixEditPath(name, value, "remove");
            } catch (e) {
              logger.error("Failed to persist removal on POSIX:");
              logger.error(String(e));
            }
          }
        }
      }
      return;
    }
  } catch (e) {
    logger.error("Fatal:");
    logger.error(String(e));
    process.exit(3);
  }
};

export default defineCmd(senvCmd, senvCmdArgs, senvCmdCfg);
