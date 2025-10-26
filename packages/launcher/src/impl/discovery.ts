// packages/launcher/src/impl/launcher/discovery.ts

import { dirname, join } from "node:path";
import { statSync } from "node:fs";
import pMap from "@reliverse/dler-mapper";
import { Glob } from "bun";
import { CommandLoadError } from "./errors";
import type {
  CmdDefinition,
  CmdMetadata,
  CmdNode,
  DiscoveryResult,
} from "./types";

// Lazy metadata loader that only loads when needed
const createLazyMetadataLoader = (filePath: string, cmdName: string) => {
  return async (): Promise<CmdMetadata> => {
    try {
      // Only load the module to extract metadata, don't execute handler
      const module = await import(filePath);
      const definition = module.default;

      if (!definition || !definition.cfg) {
        throw new Error("Invalid command definition");
      }

      return {
        name: definition.cfg.name,
        description: definition.cfg.description,
        aliases: definition.cfg.aliases,
        version: definition.cfg.version,
        examples: definition.cfg.examples,
      };
    } catch (error) {
      throw new CommandLoadError(cmdName, error);
    }
  };
};

// Resolve commands directory checking src/, dist/, and fallback paths
const resolveCommandsDirectory = (
  baseDir: string,
  cmdsDir: string,
  verbose?: boolean,
): string => {
  if (verbose) {
    console.debug(`🔍 Resolving commands directory:`);
    console.debug(`   baseDir: ${baseDir}`);
    console.debug(`   cmdsDir: ${cmdsDir}`);
  }

  // If cmdsDir is absolute or contains path separators, use it as-is
  if (cmdsDir.startsWith("/") || cmdsDir.includes("\\")) {
    const resolved = join(baseDir, cmdsDir);
    if (verbose) {
      console.debug(`   Using absolute path: ${resolved}`);
    }
    return resolved;
  }

  // Check parent directory first - this handles both dev and prod
  const parentDir = dirname(baseDir);
  
  // Check parent/src/cmds (development - when baseDir is dist/)
  const parentSrcPath = join(parentDir, "src", cmdsDir);
  try {
    const srcStats = statSync(parentSrcPath);
    if (srcStats.isDirectory()) {
      if (verbose) {
        console.debug(`   ✅ Found: ${parentSrcPath} (parent src - development)`);
      }
      return parentSrcPath;
    }
  } catch {
    if (verbose) {
      console.debug(`   ❌ Not found: ${parentSrcPath}`);
    }
  }

  // Check parent/dist/cmds (production - when baseDir is src/)
  const parentDistPath = join(parentDir, "dist", cmdsDir);
  try {
    const distStats = statSync(parentDistPath);
    if (distStats.isDirectory()) {
      if (verbose) {
        console.debug(`   ✅ Found: ${parentDistPath} (parent dist - production)`);
      }
      return parentDistPath;
    }
  } catch {
    if (verbose) {
      console.debug(`   ❌ Not found: ${parentDistPath}`);
    }
  }

  // Check src/cmds first (development)
  const srcPath = join(baseDir, "src", cmdsDir);
  try {
    const srcStats = statSync(srcPath);
    if (srcStats.isDirectory()) {
      if (verbose) {
        console.debug(`   ✅ Found: ${srcPath} (development)`);
      }
      return srcPath;
    }
  } catch {
    if (verbose) {
      console.debug(`   ❌ Not found: ${srcPath}`);
    }
  }

  // Check dist/cmds (production)
  const distPath = join(baseDir, "dist", cmdsDir);
  try {
    const distStats = statSync(distPath);
    if (distStats.isDirectory()) {
      if (verbose) {
        console.debug(`   ✅ Found: ${distPath} (production)`);
      }
      return distPath;
    }
  } catch {
    if (verbose) {
      console.debug(`   ❌ Not found: ${distPath}`);
    }
  }

  // Fallback to direct path for custom cmdsDir
  const fallbackPath = join(baseDir, cmdsDir);
  try {
    const fallbackStats = statSync(fallbackPath);
    if (fallbackStats.isDirectory()) {
      if (verbose) {
          console.debug(`   ✅ Found: ${fallbackPath} (fallback)`);
      }
      return fallbackPath;
    }
  } catch {
    if (verbose) {
      console.debug(`   ❌ Not found: ${fallbackPath}`);
    }
  }

  throw new Error(
    `Commands directory not found. Checked: ${srcPath}, ${distPath}, ${fallbackPath}`,
  );
};

export const discoverCommands = async (
  cmdsDir: string,
  baseDir?: string,
  verbose?: boolean,
): Promise<DiscoveryResult> => {
  const registry = new Map();
  const aliases = new Map();
  const metadata = new Map<string, () => Promise<CmdMetadata>>();
  const hierarchy = new Map<string, CmdNode>();
  const rootCommands = new Set<string>();

  const glob = new Glob("**/cmd.{ts,js}");
  
  // Resolve the actual commands directory (src/cmds or dist/cmds)
  const actualBaseDir = baseDir || process.cwd();
  if (verbose) {
    console.debug(`\n🔍 Discovering commands:`);
    console.debug(`   actualBaseDir: ${actualBaseDir}`);
  }
  const resolvedCommandsDir = resolveCommandsDirectory(actualBaseDir, cmdsDir, verbose);
  if (verbose) {
    console.debug(`   resolvedCommandsDir: ${resolvedCommandsDir}`);
  }

  // Collect all files first, then process in parallel
  const files = await Array.fromAsync(glob.scan(resolvedCommandsDir));
  if (verbose) {
    console.debug(`   Found ${files.length} command files`);
  }

  // Process all files in parallel with controlled concurrency
  const fileData = await pMap(
    files,
    async (file) => {
      const pathParts = file.split(/[/\\]/);
      const cmdName = pathParts[pathParts.length - 2]; // Get parent directory name
      const filePath = `${resolvedCommandsDir}/${file}`;

      // Calculate depth and parent
      const depth = pathParts.length - 1; // Subtract 1 for cmd.{ts,js}
      const parent = depth > 1 ? pathParts[0] : undefined;
      const fullPath = pathParts.slice(0, -1).join("/"); // Full path without cmd.{ts,js}

      return {
        cmdName: cmdName!,
        filePath,
        depth,
        parent,
        fullPath,
      };
    },
    { concurrency: 10 }, // Limit concurrency to avoid overwhelming filesystem
  );

  // Process all file data
  for (const {
    cmdName,
    filePath,
    depth,
    parent,
    fullPath,
  } of fileData) {
    const loader = async (): Promise<CmdDefinition> => {
      try {
        const module = await import(filePath);
        const definition = module.default;

        if (!definition || typeof definition.handler !== "function") {
          throw new Error("Invalid command definition");
        }

        return definition;
      } catch (error) {
        throw new CommandLoadError(cmdName, error);
      }
    };

    const lazyMetadataLoader = createLazyMetadataLoader(filePath, cmdName);
    metadata.set(cmdName, lazyMetadataLoader);

    registry.set(cmdName, loader);

    // Create command node for hierarchy
    const cmdNode: CmdNode = {
      name: cmdName,
      path: fullPath,
      depth,
      parent,
      children: new Map(),
      loader,
      metadata: metadata.get(cmdName)!,
    };

    hierarchy.set(cmdName, cmdNode);

    // Track root commands (depth 1)
    if (depth === 1) {
      rootCommands.add(cmdName);
    }
  }

  // Build parent-child relationships
  for (const [cmdName, node] of hierarchy) {
    if (node.parent) {
      const parentNode = hierarchy.get(node.parent);
      if (parentNode) {
        parentNode.children.set(cmdName, node);
      }
    }
  }

  return { registry, aliases, metadata, hierarchy, rootCommands };
};

export const validateCommandStructure = (
  definition: unknown,
): definition is CmdDefinition => {
  if (typeof definition !== "object" || definition === null) return false;

  const def = definition as Record<string, unknown>;

  return (
    typeof def.handler === "function" &&
    typeof def.args === "object" &&
    def.args !== null &&
    typeof def.cfg === "object" &&
    def.cfg !== null &&
    typeof (def.cfg as Record<string, unknown>).name === "string"
  );
};
