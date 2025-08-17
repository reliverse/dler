// `bun example/high-level-generators.ts`

import {
  generateApiModule,
  generateCommands,
  generateCrudModule,
  generateDbModule,
  generateModule,
  generateMultipleModules,
  regenerateExports,
} from "@/app/rempts/gen/typed-generators";

export async function highLevelGenerators() {
  console.log("🔧 Demonstration of high-level generator utilities with typed commands...\n");

  try {
    // Example 1: Simple command generation
    console.log("1. Generating simple commands:");
    await generateCommands({
      commands: ["cache-clear", "cache-stats", "cache-warm"],
      outputFile: "src/app/cmds.ts",
    });

    // Example 2: Generate CRUD module
    console.log("\n2. Generating CRUD module for 'user':");
    await generateCrudModule("user", {
      moduleRoot: "src/modules",
      overwrite: true,
    });

    // Example 3: Generate API module
    console.log("\n3. Generating API module for 'posts':");
    await generateApiModule("posts", ["get", "post", "put", "delete", "search"], {
      moduleRoot: "src/api",
      overwrite: true,
    });

    // Example 4: Generate database module
    console.log("\n4. Generating database module for 'users':");
    await generateDbModule("users", ["migrate", "seed", "rollback", "backup"], {
      moduleRoot: "src/database",
      overwrite: true,
    });

    // Example 5: Generate multiple modules at once
    console.log("\n5. Generating multiple modules:");
    await generateMultipleModules(
      [
        { name: "auth", commands: ["login", "logout", "register", "verify"] },
        { name: "profile", commands: ["get", "update", "avatar"] },
        { name: "settings", commands: ["get", "update", "reset"] },
      ],
      {
        moduleRoot: "src/features",
        overwrite: true,
      },
    );

    // Example 6: Custom module with specific commands
    console.log("\n6. Generating custom module:");
    await generateModule({
      moduleName: "deployment",
      commands: ["build", "test", "deploy", "rollback", "status"],
      moduleRoot: "src/deploy",
      overwrite: true,
    });

    // Example 7: Regenerate main exports
    console.log("\n7. Regenerating main command exports:");
    await regenerateExports("src/app/cmds.ts");

    console.log("\n✅ All high-level generators completed successfully!");
  } catch (error) {
    console.error("❌ Error during generator execution:", error);
  }
}

// Example of a complete project setup
/* async function setupFullProject() {
  console.log("🚀 Setting up complete project structure...\n");

  // Core API modules
  const apiModules = ["users", "posts", "comments", "files"];
  for (const module of apiModules) {
    await generateApiModule(module, undefined, {
      moduleRoot: "src/api",
    });
  }

  // Database modules
  const dbModules = ["users", "posts", "comments"];
  for (const module of dbModules) {
    await generateDbModule(module, undefined, {
      moduleRoot: "src/database",
    });
  }

  // Feature modules
  await generateMultipleModules(
    [
      { name: "auth", commands: ["login", "logout", "register", "reset-password"] },
      { name: "profile", commands: ["view", "edit", "delete"] },
      { name: "admin", commands: ["users", "posts", "analytics", "settings"] },
    ],
    {
      moduleRoot: "src/features",
    },
  );

  // Utility commands
  await generateCommands({
    commands: ["cache", "logs", "health", "metrics"],
    customRoot: "src/utils",
    outputFile: "src/utils/cmds.ts",
  });

  // Generate main exports
  await regenerateExports();

  console.log("✅ Complete project structure generated!");
} */

// Example with conditional generation based on environment
/* async function conditionalGeneration() {
  const isDev = process.env.NODE_ENV === "development";
  const needsAuth = process.env.ENABLE_AUTH === "true";
  const needsApi = process.env.ENABLE_API === "true";

  if (isDev) {
    await generateCommands({
      commands: ["dev-reset", "dev-seed", "dev-logs"],
      customRoot: "src/dev",
    });
  }

  if (needsAuth) {
    await generateCrudModule("auth-session");
    await generateApiModule("auth");
  }

  if (needsApi) {
    await generateMultipleModules([
      { name: "api-v1", commands: ["init", "migrate", "docs"] },
      { name: "api-v2", commands: ["init", "migrate", "docs"] },
    ]);
  }

  await regenerateExports();
} */
