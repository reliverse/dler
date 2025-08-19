// `bun example/typed-cmds-example.ts`

import { callCmd, getTypedCmd } from "../../cmds";

export async function typedCmdsExample() {
  console.log("🎯 Demonstrating typed command calls with intellisense...\n");

  try {
    // Example 1: Simple command with boolean argument
    console.log("1. Running pub command with dev mode:");
    await callCmd("pub", { dev: true });

    // Example 2: Command with multiple typed arguments
    console.log("\n2. Running check command with multiple options:");
    await callCmd("check", {
      dev: false,
      directory: "src",
      checks: "missing-deps,file-extensions",
      strict: true,
      json: false,
      // "no-exit": true // This option may not be available in current command definition,
    });

    // Example 3: Command with array arguments
    console.log("\n3. Running magic command with array targets:");
    await callCmd("magic", {
      targets: ["dist-npm", "dist-jsr"],
      concurrency: 2,
      batchSize: 50,
      stopOnError: false,
    });

    // Example 4: Command with string literal types
    console.log("\n4. Running create command with mode selection:");
    await callCmd("create", {
      mode: "files", // TypeScript will only allow "template" | "files"
      fileType: "md:README",
      destDir: "./output",
      multiple: false,
    });

    // Example 5: Using the alternative API for more control
    console.log("\n5. Using getTypedCmd for more control:");
    const { command, run } = await getTypedCmd("x");

    console.log(`Command name: ${command.meta?.name}`);
    console.log(`Command description: ${command.meta?.description}`);

    await run({
      action: "detect",
      cwd: process.cwd(),
      silent: false,
      throwOnError: true,
    });

    // Example 6: No arguments needed
    console.log("\n6. Running update command (no args):");
    await callCmd("update");

    // Example 7: Using generators with typed commands
    console.log("\n7. Running command generators:");
    await callCmd("rempts", {
      init: "test-cmd",
      overwrite: true,
      outFile: "src/app/cmds.ts",
    });

    console.log("\n✅ All typed commands executed successfully!");
  } catch (error) {
    console.error("❌ Error during execution:", error);
  }
}

// Demonstrates TypeScript intellisense features
// async function demonstrateIntellisense() {
//   // TypeScript will provide autocomplete for:

//   // 1. Command names
//   await callCmd("pub", {
//     /* autocomplete will show pub's available args */
//   });

//   // 2. Argument names and types
//   await callCmd("check", {
//     dev: true, // boolean
//     directory: "src", // string
//     checks: "missing-deps", // string
//     // TypeScript will error if you try: checks: 123 (wrong type)
//   });

//   // 3. String literal types
//   await callCmd("create", {
//     mode: "files", // Only "template" | "files" allowed
//     // mode: "invalid" // This would cause a TypeScript error
//   });

//   // 4. Required vs optional arguments
//   await callCmd("magic", {
//     targets: ["dist-npm"], // Required - TypeScript will error if missing
//     concurrency: 4, // Optional
//   });
// }

// Note: The demonstrateIntellisense function shows the types but doesn't run
// to avoid actual command execution in the example
