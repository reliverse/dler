// `bun example/generators-example.ts`

import { callCmd } from "~/app/cmds";

export async function generatorsExample() {
  console.log("🛠️ Demonstrating generator calls with typed commands...\n");

  try {
    // Example 1: Initialize new commands
    console.log("1. Initializing new commands:");
    await callCmd("rempts", {
      init: "my-new-cmd another-cmd",
      overwrite: true,
      outFile: "src/app/cmds.ts",
    });

    // Example 2: Regenerate exports file only
    console.log("\n2. Regenerating command exports:");
    await callCmd("rempts", {
      overwrite: true,
      outFile: "src/app/cmds.ts",
    });

    // Example 3: Custom commands root
    console.log("\n3. Using custom commands root:");
    await callCmd("rempts", {
      init: "custom-cmd",
      customCmdsRoot: "src/custom-commands",
      outFile: "src/custom-commands/exports.ts",
      overwrite: true,
    });

    // Example 4: Specific command directories
    console.log("\n4. Scanning specific directories:");
    await callCmd("rempts", {
      cmdDirs: ["build", "pub", "magic"],
      outFile: "src/app/core-cmds.ts",
      overwrite: true,
    });

    console.log("\n✅ All generators executed successfully!");
  } catch (error) {
    console.error("❌ Error during generator execution:", error);
  }
}

// Advanced generator patterns
/* async function advancedGeneratorExamples() {
  console.log("🚀 Advanced generator patterns...\n");

  // Batch command creation
  const commandsToCreate = ["auth", "db", "api", "deploy"];

  for (const cmdName of commandsToCreate) {
    await callCmd("rempts", {
      init: cmdName,
      overwrite: true,
      customCmdsRoot: "src/modules",
      outFile: `src/modules/${cmdName}/exports.ts`,
    });
    console.log(`✅ Created module: ${cmdName}`);
  }

  // Generate exports for all modules
  await callCmd("rempts", {
    cmdDirs: commandsToCreate,
    outFile: "src/modules/index.ts",
    overwrite: true,
  });

  console.log("✅ Generated module exports");
} */

// Conditional generator calls
/* async function conditionalGenerators() {
  const shouldCreateAuth = process.env.NEED_AUTH === "true";
  const shouldCreateAPI = process.env.NEED_API === "true";

  if (shouldCreateAuth) {
    await callCmd("rempts", {
      init: "auth login logout register",
      customCmdsRoot: "src/auth",
      outFile: "src/auth/cmds.ts",
      overwrite: true,
    });
  }

  if (shouldCreateAPI) {
    await callCmd("rempts", {
      init: "api-get api-post api-put api-delete",
      customCmdsRoot: "src/api",
      outFile: "src/api/cmds.ts",
      overwrite: true,
    });
  }

  // Always regenerate main exports
  await callCmd("rempts", {
    overwrite: true,
    outFile: "src/app/cmds.ts",
  });
} */
