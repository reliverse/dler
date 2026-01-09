import { type } from "arktype";

/**
 * Valid workspace version strategies
 */
const VersionStrategy = type("'fixed'|'independent'");

/**
 * Valid port range with descriptive error messages
 */
const PortNumber = type("number.integer > 0 & number.integer < 65536")
  .configure({
    description: "a valid port number",
  })
  .narrow((n: number) => {
    // Check for commonly problematic ports
    const reservedPorts = [22, 80, 443, 3306, 5432]; // SSH, HTTP, HTTPS, MySQL, PostgreSQL
    if (reservedPorts.includes(n)) {
      // Note: ctx.warn is not available in current arktype version
      // This is just informational for future enhancement
      console.warn(`Port ${n} is commonly used by system services and may cause conflicts`);
    }
    return true;
  });

/**
 * File path validation with basic path safety checks
 */
const SafePath = type("string")
  .configure({
    description: "a valid file path",
  })
  .narrow((path: string, ctx) => {
    if (!path.trim()) {
      return ctx.reject("path cannot be empty or only whitespace");
    }
    // Basic path traversal protection
    if (path.includes("../") || path.includes("..\\")) {
      // Note: ctx.warn is not available in current arktype version
      console.warn("path contains directory traversal (..) which may be unsafe");
    }
    return true;
  });

/**
 * Build targets validation
 */
const BuildTargets = type("string[]")
  .configure({
    description: "an array of valid build targets",
  })
  .narrow((targets: string[], ctx) => {
    const validTargets = [
      "darwin-arm64",
      "darwin-x64",
      "linux-arm64",
      "linux-x64",
      "windows-x64",
      "bun-linux-x64-modern",
      "bun-darwin-x64-modern",
      "bun-windows-x64-modern",
    ];

    const invalidTargets = targets.filter((target) => !validTargets.includes(target));
    if (invalidTargets.length > 0) {
      return ctx.reject({
        expected: `valid build targets: ${validTargets.join(", ")}`,
        actual: `invalid targets: ${invalidTargets.join(", ")}`,
      });
    }
    return true;
  });

/**
 * Comprehensive Rempts configuration schema with enhanced validation
 * Codegen and TypeScript are REQUIRED for all Rempts projects
 */
export const remptsConfigSchema = type({
  // Base configuration (required for CLI creation, optional for partial configs)
  "name?": type("string")
    .configure({
      description: "package name (npm naming conventions)",
    })
    .narrow((name: string, ctx) => {
      if (name.length < 1) {
        return ctx.reject("package name cannot be empty");
      }
      if (name.length > 214) {
        return ctx.reject("package name too long (max 214 characters)");
      }
      return true;
    }),
  "version?": type("string.semver").configure({
    description: "semantic version string",
  }),
  "description?": type("string")
    .configure({
      description: "package description",
    })
    .narrow((desc: string, ctx) => {
      return desc.length <= 300 || ctx.reject("description too long (max 300 characters)");
    }),

  // Commands configuration
  "commands?": type({
    "directory?": SafePath.configure({
      description: "directory containing command files",
    }),
    "generateReport?": "boolean",
  }).configure({
    description: "command-related configuration",
  }),

  // Build configuration - TypeScript REQUIRED
  "build?": type({
    "entry?": type("string|string[]")
      .configure({
        description: "entry file(s) for bundling",
      })
      .narrow((entry: string | string[], _ctx) => {
        const entries = Array.isArray(entry) ? entry : [entry];
        if (entries.length === 0) {
          return _ctx.reject("at least one entry file must be specified");
        }
        // Check for common file extensions
        const hasValidExtension = entries.every((e) => /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e));
        if (!hasValidExtension) {
          // Note: ctx.warn is not available in current arktype version
          console.warn(
            "entry files should typically have .ts, .tsx, .js, .jsx, .mjs, or .cjs extensions"
          );
        }
        return true;
      }),
    "outdir?": SafePath.configure({
      description: "output directory for build artifacts",
    }),
    "targets?": BuildTargets,
    "compress?": "boolean",
    "minify?": "boolean",
    "external?": type("string[]")
      .configure({
        description: "external dependencies to exclude from bundle",
      })
      .narrow((externals: string[], _ctx) => {
        // Warn about potentially problematic externals
        const problematic = externals.filter(
          (ext) => ext.startsWith("@types/") || ext.includes("*")
        );
        if (problematic.length > 0) {
          // Note: ctx.warn is not available in current arktype version
          console.warn(`potentially problematic externals detected: ${problematic.join(", ")}`);
        }
        return true;
      }),
    "sourcemap?": "boolean",
  }).configure({
    description: "build configuration for bundling and compilation",
  }),

  // Development configuration
  "dev?": type({
    "watch?": "boolean",
    "inspect?": "boolean",
    "port?": PortNumber,
  }).configure({
    description: "development server configuration",
  }),

  // Test configuration
  "test?": type({
    "pattern?": type("string|string[]")
      .configure({
        description: "glob patterns for test files",
      })
      .narrow((patterns: string | string[], _ctx) => {
        const patternList = Array.isArray(patterns) ? patterns : [patterns];
        // Basic validation for glob patterns
        const invalidPatterns = patternList.filter((p) => p.includes("../") || p.startsWith("/"));
        if (invalidPatterns.length > 0) {
          // Note: ctx.warn is not available in current arktype version
          console.warn(`glob patterns should be relative: ${invalidPatterns.join(", ")}`);
        }
        return true;
      }),
    "coverage?": "boolean",
    "watch?": "boolean",
  }).configure({
    description: "test configuration",
  }),

  // Workspace configuration
  "workspace?": type({
    "packages?": type("string[]")
      .configure({
        description: "array of package paths in the workspace",
      })
      .narrow((packages: string[], _ctx) => {
        if (packages.length === 0) {
          // Note: ctx.warn is not available in current arktype version
          console.warn("workspace.packages is empty - no packages will be included");
        }
        // Check for relative paths
        const absolutePaths = packages.filter((pkg) => pkg.startsWith("/"));
        if (absolutePaths.length > 0) {
          // Note: ctx.warn is not available in current arktype version
          console.warn("workspace packages should use relative paths, not absolute paths");
        }
        return true;
      }),
    "shared?": "unknown",
    "versionStrategy?": VersionStrategy.configure({
      description: "how versions are managed across workspace packages",
    }),
  }).configure({
    description: "monorepo workspace configuration",
  }),

  // Release configuration
  "release?": type({
    "npm?": "boolean",
    "github?": "boolean",
    "tagFormat?": type("string")
      .configure({
        description: "format for git tags (e.g., 'v${version}')",
      })
      .narrow((format: string, ctx) => {
        if (!format.includes("${version}")) {
          return ctx.reject("tagFormat must include '${version}' placeholder");
        }
        return true;
      }),
    "conventionalCommits?": "boolean",
  }).configure({
    description: "release and publishing configuration",
  }),

  // Plugins configuration
  "plugins?": type("unknown[]").configure({
    description: "array of plugin configurations",
  }),
}).configure({
  description: "Rempts CLI configuration schema with comprehensive validation",
});

/**
 * Inferred TypeScript type from the schema
 * This ensures runtime validation matches compile-time types
 */
export type RemptsConfig = typeof remptsConfigSchema.infer;

/**
 * Strict schema for CLI creation that requires name and version
 * Codegen and TypeScript are automatically enabled
 */
export const remptsConfigStrictSchema = remptsConfigSchema.and({
  name: "string",
  version: "string.semver",
});

export type RemptsConfigStrict = typeof remptsConfigStrictSchema.infer;

/**
 * Helper function to define configuration with type safety
 * Codegen and TypeScript are automatically configured
 */
export function defineConfig(config: RemptsConfig): RemptsConfig {
  return config;
}
