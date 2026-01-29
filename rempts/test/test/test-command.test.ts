import { expect, test } from "bun:test";
import { relico } from "@reliverse/relico";
import { defineCommand, option } from "@reliverse/rempts";
import { type } from "arktype";
import { mockInteractive, mockPromptResponses, mockShellCommands } from "../src/helpers";
import { expectCommand, testCommand } from "../src/mod";

test("testCommand - basic command execution", async () => {
  const command = defineCommand({
    description: "Say hello",
    handler: async () => {
      console.log(relico.green("Hello, world!"));
    },
  });

  const result = await testCommand(command);

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("Hello, world!");
  expect(result.stderr).toBe("");
});

test("testCommand - with flags", async () => {
  const command = defineCommand({
    description: "Greet someone",
    options: {
      name: option(type("string | undefined")),
      loud: option(type("boolean | undefined"), { short: "l" }),
    },
    handler: async ({ flags }) => {
      const message = `Hello, ${flags.name}!`;
      console.log(flags.loud ? message.toUpperCase() : message);
    },
  });

  const result = await testCommand(command, {
    flags: { name: "Alice", loud: true },
  });

  expect(result.stdout).toBe("HELLO, ALICE!");
  expectCommand(result).toHaveSucceeded();
});

test("testCommand - with prompts", async () => {
  const command = defineCommand({
    description: "Setup wizard",
    handler: async ({ prompt }) => {
      const name = await prompt("What is your name?");
      const confirmed = await prompt.confirm("Continue?", { default: true });

      if (confirmed) {
        console.log(relico.green(`Welcome, ${name}!`));
      }
    },
  });

  const result = await testCommand(command, {
    stdin: ["Alice", "y"],
  });

  expect(result.stdout).toContain("What is your name?");
  expect(result.stdout).toContain("Alice");
  expect(result.stdout).toContain("Continue?");
  expect(result.stdout).toContain("Welcome, Alice!");
});

test("testCommand - select prompt", async () => {
  const command = defineCommand({
    description: "Choose an option",
    handler: async ({ prompt }) => {
      const choice = await prompt.select("Pick a color:", {
        options: [
          { label: "red", value: "red" },
          { label: "green", value: "green" },
          { label: "blue", value: "blue" },
        ],
      });
      console.log(`You chose: ${choice}`);
    },
  });

  const result = await testCommand(command, {
    stdin: ["2"], // Select second option (green)
  });

  expect(result.stdout).toContain("Pick a color:");
  expect(result.stdout).toContain("1. red");
  expect(result.stdout).toContain("2. green");
  expect(result.stdout).toContain("3. blue");
  expect(result.stdout).toContain("You chose: green");
});

test("testCommand - spinner", async () => {
  const command = defineCommand({
    description: "Process something",
    handler: async ({ spinner }) => {
      const spin = spinner("Processing...");
      spin.update("Still processing...");
      spin.succeed("Done!");
    },
  });

  const result = await testCommand(command);

  expect(result.stdout).toContain("⠋ Processing...");
  expect(result.stdout).toContain("⠋ Still processing...");
  expect(result.stdout).toContain("✅ Done!");
});

test("testCommand - shell mock", async () => {
  const command = defineCommand({
    description: "Show git info",
    handler: async ({ shell }) => {
      const branch = await shell`git branch --show-current`.text();
      console.log(`Current branch: ${branch.trim()}`);
    },
  });

  const result = await testCommand(command);

  expect(result.stdout).toContain("$ git branch --show-current");
  expect(result.stdout).toContain("Current branch: main");
});

test("testCommand - error handling", async () => {
  const command = defineCommand({
    description: "Command that fails",
    handler: async () => {
      throw new Error("Something went wrong!");
    },
  });

  const result = await testCommand(command);

  expectCommand(result).toHaveFailed();
  expectCommand(result).toContainInStderr("Something went wrong!");
  expect(result.error).toBeDefined();
  expect(result.error?.message).toBe("Something went wrong!");
});

test("expectCommand matchers", async () => {
  const command = defineCommand({
    description: "Test matchers",
    handler: async () => {
      console.log("Success message");
      console.error("Error message");
    },
  });

  const result = await testCommand(command);

  // Test all matchers
  expectCommand(result).toHaveSucceeded();
  expectCommand(result).toHaveExitCode(0);
  expectCommand(result).toContainInStdout("Success message");
  expectCommand(result).toContainInStderr("Error message");
  expectCommand(result).toMatchStdout(/Success/);
  expectCommand(result).toMatchStderr(/Error/);
});

test("testCommand - with mockPrompts", async () => {
  const command = defineCommand({
    description: "User survey",
    handler: async ({ prompt }) => {
      const name = await prompt("What is your name?");
      const age = await prompt("What is your age?");
      const happy = await prompt.confirm("Are you happy?");
      console.log(`${name} (${age}) is ${happy ? "happy" : "not happy"}`);
    },
  });

  const result = await testCommand(
    command,
    mockPromptResponses({
      "What is your name?": "Bob",
      "What is your age?": "25",
      "Are you happy?": "yes",
    })
  );

  expect(result.stdout).toContain("Bob (25) is happy");
});

test("testCommand - with mockShellCommands", async () => {
  const command = defineCommand({
    description: "Deploy app",
    handler: async ({ shell }) => {
      const version = await shell`npm --version`.text();
      const branch = await shell`git branch --show-current`.text();
      console.log(`Deploying from ${branch.trim()} with npm ${version.trim()}`);
    },
  });

  const result = await testCommand(
    command,
    mockShellCommands({
      "npm --version": "10.2.0\n",
      "git branch --show-current": "feature/awesome\n",
    })
  );

  expect(result.stdout).toContain("Deploying from feature/awesome with npm 10.2.0");
});

test("testCommand - mockInteractive helper", async () => {
  const command = defineCommand({
    description: "Interactive setup",
    handler: async ({ prompt, shell }) => {
      const name = await prompt("Project name:");
      const useTs = await prompt.confirm("Use TypeScript?");
      const gitUser = await shell`git config user.name`.text();
      console.log(`Setting up ${name} (TS: ${useTs}) for ${gitUser.trim()}`);
    },
  });

  const result = await testCommand(
    command,
    mockInteractive(
      {
        "Project name:": "my-app",
        "Use TypeScript?": "y",
      },
      {
        "git config user.name": "Alice Developer\n",
      }
    )
  );

  expect(result.stdout).toContain("Setting up my-app (TS: true) for Alice Developer");
});

test("testCommand - validation with retry using mockPrompts", async () => {
  const emailSchema = type("string.email");

  const command = defineCommand({
    description: "Register user",
    handler: async ({ prompt }) => {
      const email = await prompt("Enter email:", { schema: emailSchema });
      console.log(`Registered: ${email}`);
    },
  });

  const result = await testCommand(
    command,
    mockPromptResponses({
      "Enter email:": ["not-an-email", "still-bad", "valid@email.com"],
    })
  );

  expect(result.stderr).toContain("must be an email address");
  expect(result.stdout).toContain("Registered: valid@email.com");
});
