import type { PackageJson } from "pkg-types";

import { relinka } from "@reliverse/relinka";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { readPackageJSON } from "pkg-types";
import { glob } from "tinyglobby";

// Types
type MigrationConfig = {
  projectRoot: string;
  dryRun: boolean;
  backup: boolean;
  selective: string[];
  skipFrameworks: string[];
  outputDir?: string;
};

type ProjectAnalysis = {
  packageJson: PackageJson;
  hasTypeScript: boolean;
  hasTests: boolean;
  framework: string | null;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  configFiles: string[];
  sourceFiles: string[];
  testFiles: string[];
};

type TransformResult = {
  filePath: string;
  originalContent: string;
  transformedContent: string;
  changes: string[];
};

type MigrationReport = {
  filesTransformed: number;
  transformResults: TransformResult[];
  manualSteps: string[];
  errors: string[];
  warnings: string[];
};

// Node.js modules that should use node: prefix
const NODE_MODULES = [
  "assert",
  "async_hooks",
  "buffer",
  "child_process",
  "cluster",
  "crypto",
  "dgram",
  "diagnostics_channel",
  "dns",
  "dns/promises",
  "events",
  "fs",
  "fs/promises",
  "http",
  "http2",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "punycode",
  "querystring",
  "readline",
  "readline/promises",
  "stream",
  "stream/consumers",
  "stream/promises",
  "stream/web",
  "string_decoder",
  "test",
  "test/reporters",
  "timers/promises",
  "tls",
  "trace_events",
  "tty",
  "url",
  "util",
  "util/types",
  "v8",
  "vm",
  "wasi",
  "worker_threads",
  "zlib",
];

// Bun-specific API replacements
const BUN_API_REPLACEMENTS = {
  // Database drivers to Bun alternatives
  pg: 'import { sql } from "bun";',
  postgres: 'import { sql } from "bun";',
  sqlite3: 'import { Database } from "bun:sqlite";',
  "better-sqlite3": 'import { Database } from "bun:sqlite";',

  // Redis clients
  redis: 'import { redis } from "bun";',
  ioredis: 'import { redis } from "bun";',

  // Utilities
  glob: 'import { Glob } from "bun";',
  semver: 'import { semver } from "bun";',
  bcrypt: 'import { password } from "bun";',
  argon2: 'import { password } from "bun";',

  // Test runners
  jest: 'import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";',
  "@jest/globals":
    'import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";',
  vitest:
    'import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";',

  // FFI libraries
  "node-ffi": 'import { dlopen, FFIType } from "bun:ffi";',
  "node-ffi-napi": 'import { dlopen, FFIType } from "bun:ffi";',
  ffi: 'import { dlopen, FFIType } from "bun:ffi";',
};

// Core analysis functions
const analyzeProject = async (
  projectRoot: string,
): Promise<ProjectAnalysis> => {
  const packageJsonPath = join(projectRoot, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error("No package.json found in project root");
  }

  const packageJson = await readPackageJSON(projectRoot);
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  const allDeps = [...dependencies, ...devDependencies];

  // Detect framework
  const framework = detectFramework(allDeps);

  // Find files
  const sourceFiles = await glob("**/*.{ts,tsx,js,jsx}", {
    cwd: projectRoot,
    ignore: ["node_modules/**", "dist/**", "build/**", ".next/**"],
  });

  const testFiles = await glob("**/*.{test,spec}.{ts,tsx,js,jsx}", {
    cwd: projectRoot,
    ignore: ["node_modules/**"],
  });

  const configFiles = await glob(
    "{*.config.{js,ts,json},.*rc*,tsconfig.json}",
    {
      cwd: projectRoot,
    },
  );

  return {
    packageJson,
    hasTypeScript:
      allDeps.includes("typescript") ||
      sourceFiles.some((f) => f.endsWith(".ts") || f.endsWith(".tsx")),
    hasTests: testFiles.length > 0,
    framework,
    dependencies,
    devDependencies,
    scripts: packageJson.scripts || {},
    configFiles,
    sourceFiles,
    testFiles,
  };
};

const detectFramework = (dependencies: string[]): string | null => {
  if (dependencies.includes("next")) return "next";
  if (dependencies.includes("react")) return "react";
  if (dependencies.includes("vue")) return "vue";
  if (dependencies.includes("svelte")) return "svelte";
  if (dependencies.includes("express")) return "express";
  if (dependencies.includes("fastify")) return "fastify";
  return null;
};

// Package.json transformations
const transformPackageJson = (analysis: ProjectAnalysis): TransformResult => {
  const { packageJson } = analysis;
  const changes: string[] = [];

  // Transform scripts
  const newScripts: Record<string, string> = {};
  for (const [name, script] of Object.entries(packageJson.scripts || {})) {
    let newScript = script as string;

    // Replace package managers
    newScript = newScript.replace(/\bnpm run\b/g, "bun run");
    newScript = newScript.replace(/\bnpm install\b/g, "bun install");
    newScript = newScript.replace(/\byarn\b/g, "bun");
    newScript = newScript.replace(/\bnpx\b/g, "bunx");

    // Replace test runners
    if (newScript.includes("jest")) {
      newScript = newScript.replace(/jest/g, "bun test");
      changes.push(`Replaced Jest with bun test in script "${name}"`);
    }

    if (newScript.includes("vitest")) {
      newScript = newScript.replace(/vitest/g, "bun test");
      changes.push(`Replaced Vitest with bun test in script "${name}"`);
    }

    // Replace Node.js with Bun
    if (newScript.includes("node ")) {
      newScript = newScript.replace(/\bnode\s+/g, "bun ");
      changes.push(`Replaced Node.js with Bun runtime in script "${name}"`);
    }

    newScripts[name] = newScript;

    if (newScript !== script) {
      changes.push(`Updated script "${name}": ${script} → ${newScript}`);
    }
  }

  // Replace dependencies with Bun alternatives
  const newDependencies = { ...packageJson.dependencies };
  const newDevDependencies = { ...packageJson.devDependencies };

  const dependencyReplacements: Record<string, string | null> = {
    // Database drivers
    pg: null, // Will use Bun.sql
    postgres: null,
    sqlite3: null, // Will use bun:sqlite
    "better-sqlite3": null,
    redis: null, // Will use Bun.redis
    ioredis: null,

    // Utilities that have Bun alternatives
    glob: null, // Will use Bun.Glob
    semver: null, // Will use Bun.semver
    bcrypt: null, // Will use Bun.password
    argon2: null,

    // Test runners
    jest: null,
    "@types/jest": null,
    vitest: null,
    "@vitest/ui": null,
    "ts-jest": null,

    // Build tools that Bun replaces
    webpack: null,
    rollup: null,
    esbuild: null, // Bun uses esbuild internally

    // FFI libraries
    "node-ffi": null,
    "node-ffi-napi": null,
    ffi: null,
  };

  // Remove replaced dependencies
  for (const [oldDep] of Object.entries(dependencyReplacements)) {
    if (newDependencies[oldDep]) {
      delete newDependencies[oldDep];
      changes.push(`Removed dependency: ${oldDep} (replaced by Bun built-in)`);
    }
    if (newDevDependencies[oldDep]) {
      delete newDevDependencies[oldDep];
      changes.push(
        `Removed dev dependency: ${oldDep} (replaced by Bun built-in)`,
      );
    }
  }

  const newPackageJson = {
    ...packageJson,
    scripts: newScripts,
    dependencies: newDependencies,
    devDependencies: newDevDependencies,
  };

  return {
    filePath: "package.json",
    originalContent: JSON.stringify(packageJson, null, 2),
    transformedContent: JSON.stringify(newPackageJson, null, 2),
    changes,
  };
};

// Source code transformations
const transformSourceFile = (
  filePath: string,
  content: string,
): TransformResult => {
  let transformedContent = content;
  const changes: string[] = [];

  // Transform Node.js imports to use node: prefix
  for (const nodeModule of NODE_MODULES) {
    const patterns = [
      // import ... from "module"
      new RegExp(`import\\s+([^"']*?)from\\s+['"]${nodeModule}['"];?`, "g"),
      // import("module")
      new RegExp(`import\\s*\\(\\s*['"]${nodeModule}['"]\\s*\\)`, "g"),
      // require("module")
      new RegExp(`require\\s*\\(\\s*['"]${nodeModule}['"]\\s*\\)`, "g"),
    ];

    for (const pattern of patterns) {
      if (pattern.test(transformedContent)) {
        transformedContent = transformedContent.replace(pattern, (match) =>
          match
            .replace(`"${nodeModule}"`, `"node:${nodeModule}"`)
            .replace(`'${nodeModule}'`, `'node:${nodeModule}'`),
        );
        if (!changes.includes(`Added node: prefix to ${nodeModule} imports`)) {
          changes.push(`Added node: prefix to ${nodeModule} imports`);
        }
      }
    }
  }

  // Transform to Bun-specific APIs
  for (const [oldModule, newImport] of Object.entries(BUN_API_REPLACEMENTS)) {
    if (
      content.includes(`from "${oldModule}"`) ||
      content.includes(`from '${oldModule}'`)
    ) {
      // Replace import statements
      const importPattern = new RegExp(
        `import\\s+.*?from\\s+['"]${oldModule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"];?\\s*`,
        "g",
      );

      if (importPattern.test(transformedContent)) {
        transformedContent = transformedContent.replace(
          importPattern,
          `${newImport}\n`,
        );
        changes.push(`Replaced ${oldModule} import with Bun alternative`);
      }
    }
  }

  // File system operations - convert to async Bun APIs
  transformedContent = transformedContent.replace(
    /fs\.readFileSync\((.*?)\)/g,
    "await Bun.file($1).text()",
  );

  transformedContent = transformedContent.replace(
    /fs\.writeFileSync\((.*?),\s*(.*?)\)/g,
    "await Bun.write($1, $2)",
  );

  transformedContent = transformedContent.replace(
    /fs\.existsSync\((.*?)\)/g,
    "await Bun.file($1).exists()",
  );

  if (
    transformedContent.includes("Bun.file") ||
    transformedContent.includes("Bun.write")
  ) {
    changes.push("Converted fs operations to Bun file API");
  }

  // Transform crypto operations to Bun.password
  if (content.includes("bcrypt.hash") || content.includes("argon2.hash")) {
    transformedContent = transformedContent.replace(
      /bcrypt\.hash\((.*?),\s*(.*?)\)/g,
      "await Bun.password.hash($1, { algorithm: 'bcrypt', cost: $2 })",
    );
    transformedContent = transformedContent.replace(
      /argon2\.hash\((.*?)\)/g,
      "await Bun.password.hash($1, { algorithm: 'argon2id' })",
    );
    changes.push("Converted password hashing to Bun.password");
  }

  // Transform glob usage
  if (content.includes("glob.sync") || content.includes("glob(")) {
    transformedContent = transformedContent.replace(
      /glob\.sync\((.*?)\)/g,
      "new Glob($1).scanSync('.')",
    );
    transformedContent = transformedContent.replace(
      /glob\((.*?)\)/g,
      "new Glob($1).scan('.')",
    );
    changes.push("Converted glob operations to Bun.Glob");
  }

  // Transform semver usage
  if (content.includes("semver.")) {
    transformedContent = transformedContent.replace(/semver\./g, "Bun.semver.");
    changes.push("Converted semver operations to Bun.semver");
  }

  // Transform SQLite usage
  if (content.includes("new Database") && content.includes("sqlite3")) {
    transformedContent = transformedContent.replace(
      /new sqlite3\.Database\((.*?)\)/g,
      "new Database($1)",
    );
    changes.push("Converted SQLite3 to bun:sqlite");
  }

  // Transform Redis usage
  if (
    content.includes("createClient") &&
    (content.includes("redis") || content.includes("ioredis"))
  ) {
    transformedContent = transformedContent.replace(
      /redis\.createClient\((.*?)\)/g,
      "Bun.redis($1)",
    );
    transformedContent = transformedContent.replace(
      /new Redis\((.*?)\)/g,
      "Bun.redis($1)",
    );
    changes.push("Converted Redis client to Bun.redis");
  }

  // Transform FFI usage
  if (content.includes("ffi.Library") || content.includes("dlopen")) {
    transformedContent = transformedContent.replace(
      /ffi\.Library\((.*?),\s*(.*?)\)/g,
      "dlopen($1, $2)",
    );
    changes.push("Converted FFI usage to bun:ffi");
  }

  // Express to Bun.serve conversion (basic)
  if (content.includes("express()")) {
    const expressReplacement = `
import { serve } from "bun";

const server = serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    
    // Add your routes here
    if (url.pathname === "/") {
      return new Response("Hello from Bun!");
    }
    
    return new Response("Not Found", { status: 404 });
  },
});

relinka("log", \`Server running on localhost:\${server.port}\`);
`;

    if (content.includes("const app = express()")) {
      transformedContent = transformedContent.replace(
        /const app = express\(\);[\s\S]*?app\.listen\(.*?\);?/,
        expressReplacement,
      );
      changes.push(
        "Converted Express app to Bun.serve (manual route migration needed)",
      );
    }
  }

  // Transform child_process to Bun.$
  if (content.includes("exec") || content.includes("spawn")) {
    transformedContent = transformedContent.replace(
      /exec\((.*?)\)/g,
      "await Bun.$`$1`",
    );
    transformedContent = transformedContent.replace(
      /spawn\((.*?),\s*(.*?)\)/g,
      "await Bun.$`$1 ${$2.join(' ')}`",
    );
    changes.push("Converted child_process operations to Bun.$");
  }

  return {
    filePath,
    originalContent: content,
    transformedContent,
    changes,
  };
};

// Test file transformations
const transformTestFile = (
  filePath: string,
  content: string,
): TransformResult => {
  let transformedContent = content;
  const changes: string[] = [];

  // Jest/Vitest to bun:test
  if (content.includes("@jest/globals") || content.includes("vitest")) {
    transformedContent = transformedContent.replace(
      /import.*?from\s+['"]@jest\/globals['"];?\s*/g,
      'import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";\n',
    );
    transformedContent = transformedContent.replace(
      /import.*?from\s+['"]vitest['"];?\s*/g,
      'import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";\n',
    );
    changes.push("Replaced Jest/Vitest imports with bun:test");
  }

  // Transform jest to node:test for compatibility
  if (content.includes("jest.")) {
    transformedContent = transformedContent.replace(/jest\.mock/g, "mock");
    transformedContent = transformedContent.replace(/jest\.spyOn/g, "spyOn");
    transformedContent = transformedContent.replace(/jest\.fn/g, "mock");
    changes.push("Updated Jest APIs to bun:test equivalents");
  }

  // Add bun:test import if test functions are used but no import exists
  if (
    (content.includes("describe(") ||
      content.includes("it(") ||
      content.includes("test(")) &&
    !content.includes('from "bun:test"') &&
    !content.includes("from 'bun:test'")
  ) {
    transformedContent = `import { describe, it, test, expect, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";\n\n${transformedContent}`;
    changes.push("Added bun:test import for test functions");
  }

  return {
    filePath,
    originalContent: content,
    transformedContent,
    changes,
  };
};

// Config file generators
const generateBunConfig = (analysis: ProjectAnalysis): string => {
  return `# Bun configuration file
[install]
cache = true
auto = "bun"
production = false

[test]
preload = ["./test/setup.ts"]
timeout = 5000

[run]
shell = "bun"

[build]
target = "bun"
outdir = "./dist"
sourcemap = "external"

${
  analysis.hasTypeScript
    ? `
[typescript]
compilerOptions = "tsconfig.json"
`
    : ""
}
`;
};

const generateDockerfile = (analysis: ProjectAnalysis): string => {
  return `# Use Bun's official image
FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the app (if needed)
${analysis.scripts.build ? "RUN bun run build" : ""}

# Start the app
EXPOSE 3000
CMD ["bun", "start"]
`;
};

// File operations
const createBackup = async (projectRoot: string): Promise<void> => {
  const backupDir = join(projectRoot, ".bun-migration-backup");
  if (!existsSync(backupDir)) {
    await mkdir(backupDir, { recursive: true });
  }

  // Copy package.json
  const packageJsonPath = join(projectRoot, "package.json");
  if (existsSync(packageJsonPath)) {
    const backupPath = join(backupDir, "package.json");
    const packageJson = await readPackageJSON(projectRoot);
    await writeFile(backupPath, JSON.stringify(packageJson, null, 2));
  }
};

const writeTransformedFile = async (
  projectRoot: string,
  result: TransformResult,
  dryRun: boolean,
): Promise<void> => {
  if (dryRun) {
    relinka("log", `[DRY RUN] Would transform ${result.filePath}`);
    for (const change of result.changes) {
      relinka("log", `  - ${change}`);
    }
    return;
  }

  const fullPath = join(projectRoot, result.filePath);
  await writeFile(fullPath, result.transformedContent);
  relinka("log", `✓ Transformed ${result.filePath}`);
  for (const change of result.changes) {
    relinka("log", `  - ${change}`);
  }
};

// Main migration function
const migrateProject = async (
  config: MigrationConfig,
): Promise<MigrationReport> => {
  const { projectRoot, dryRun, backup } = config;

  relinka("log", "🔍 Analyzing project...");
  const analysis = await analyzeProject(projectRoot);

  relinka(
    "log",
    `📊 Analysis complete:
  - Framework: ${analysis.framework || "None detected"}
  - TypeScript: ${analysis.hasTypeScript ? "Yes" : "No"}
  - Tests: ${analysis.hasTests ? "Yes" : "No"}
  - Source files: ${analysis.sourceFiles.length}
  - Test files: ${analysis.testFiles.length}
`,
  );

  if (backup && !dryRun) {
    relinka("log", "💾 Creating backup...");
    await createBackup(projectRoot);
  }

  const transformResults: TransformResult[] = [];
  const manualSteps: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Transform package.json
    relinka("log", "📦 Transforming package.json...");
    const packageJsonResult = transformPackageJson(analysis);
    transformResults.push(packageJsonResult);
    await writeTransformedFile(projectRoot, packageJsonResult, dryRun);

    // Transform source files
    relinka("log", "🔧 Transforming source files...");
    for (const sourceFile of analysis.sourceFiles.slice(0, 50)) {
      // Increased limit
      try {
        const fullPath = join(projectRoot, sourceFile);
        const content = await readFile(fullPath, "utf-8");
        const result = transformSourceFile(sourceFile, content);

        if (result.changes.length > 0) {
          transformResults.push(result);
          await writeTransformedFile(projectRoot, result, dryRun);
        }
      } catch (error) {
        errors.push(`Failed to transform ${sourceFile}: ${error}`);
      }
    }

    // Transform test files
    if (analysis.hasTests) {
      relinka("log", "🧪 Transforming test files...");
      for (const testFile of analysis.testFiles.slice(0, 20)) {
        // Increased limit
        try {
          const fullPath = join(projectRoot, testFile);
          const content = await readFile(fullPath, "utf-8");
          const result = transformTestFile(testFile, content);

          if (result.changes.length > 0) {
            transformResults.push(result);
            await writeTransformedFile(projectRoot, result, dryRun);
          }
        } catch (error) {
          errors.push(`Failed to transform test ${testFile}: ${error}`);
        }
      }
    }

    // Generate new config files
    if (!dryRun) {
      relinka("log", "⚙️  Generating Bun configuration...");
      const bunConfig = generateBunConfig(analysis);
      await writeFile(join(projectRoot, "bunfig.toml"), bunConfig);

      const dockerfile = generateDockerfile(analysis);
      await writeFile(join(projectRoot, "Dockerfile.bun"), dockerfile);
    }

    // Add manual steps
    manualSteps.push("Run 'bun install' to install dependencies with Bun");
    manualSteps.push(
      "Update your CI/CD scripts to use 'bun' instead of npm/yarn",
    );
    manualSteps.push("Test your application thoroughly after migration");
    manualSteps.push("Review async/await usage in converted file operations");

    if (analysis.framework === "express") {
      manualSteps.push("Manual Express route migration to Bun.serve required");
      manualSteps.push("Review middleware conversions");
    }

    if (
      analysis.dependencies.includes("pg") ||
      analysis.dependencies.includes("postgres")
    ) {
      manualSteps.push("Update database queries to use Bun.sql syntax");
    }

    if (
      analysis.dependencies.includes("sqlite3") ||
      analysis.dependencies.includes("better-sqlite3")
    ) {
      manualSteps.push("Update SQLite usage to bun:sqlite API");
    }

    if (
      analysis.dependencies.includes("redis") ||
      analysis.dependencies.includes("ioredis")
    ) {
      manualSteps.push("Update Redis client usage to Bun.redis API");
    }

    if (
      analysis.dependencies.includes("bcrypt") ||
      analysis.dependencies.includes("argon2")
    ) {
      manualSteps.push("Update password hashing to Bun.password API");
    }
  } catch (error) {
    errors.push(`Migration failed: ${error}`);
  }

  return {
    filesTransformed: transformResults.length,
    transformResults,
    manualSteps,
    errors,
    warnings,
  };
};

export async function migrateAnythingToBun({
  project = ".",
  dryRun = false,
  noBackup = false,
}: {
  project?: string;
  dryRun?: boolean;
  noBackup?: boolean;
}) {
  const config: MigrationConfig = {
    projectRoot: resolve(project),
    dryRun,
    backup: !noBackup,
    selective: [],
    skipFrameworks: [],
  };

  relinka("log", "🚀 Starting Bun migration...");
  relinka("log", `📁 Project: ${config.projectRoot}`);
  relinka("log", `🔍 Mode: ${config.dryRun ? "DRY RUN" : "LIVE MIGRATION"}`);
  relinka("log", "");

  try {
    const report = await migrateProject(config);

    relinka("log", "\n✅ Migration complete!");
    relinka("log", `📊 Files transformed: ${report.filesTransformed}`);

    if (report.manualSteps.length > 0) {
      relinka("log", "\n📋 Manual steps required:");
      for (const step of report.manualSteps) {
        relinka("log", `  • ${step}`);
      }
    }

    if (report.warnings.length > 0) {
      relinka("log", "\n⚠️  Warnings:");
      for (const warning of report.warnings) {
        relinka("log", `  • ${warning}`);
      }
    }

    if (report.errors.length > 0) {
      relinka("log", "\n❌ Errors:");
      for (const error of report.errors) {
        relinka("log", `  • ${error}`);
      }
    }

    if (!config.dryRun) {
      relinka("log", "\n🎉 Your project has been migrated to Bun!");
      relinka("log", "Run 'bun install' to get started.");
    }
  } catch (error) {
    relinka("error", "❌ Migration failed:", error);
    process.exit(1);
  }
}
