import { defineArgs, defineCommand } from "@reliverse/rempts";

const operationArgs = defineArgs({
  cwd: {
    type: "string",
    description: "Current working directory",
  },
  workspace: {
    type: "boolean",
    description: "Add to workspace",
  },
  silent: {
    type: "boolean",
    description: "Run in silent mode",
  },
});

const install = defineCommand({
  meta: {
    name: "install",
    description: "Install dependencies",
  },
  args: defineArgs({
    ...operationArgs,
    name: {
      type: "positional",
      description: "Dependency name",
      required: false,
    },
    dev: {
      type: "boolean",
      alias: "D",
      description: "Add as dev dependency",
    },
    global: {
      type: "boolean",
      alias: "g",
      description: "Add globally",
    },
    "frozen-lockfile": {
      type: "boolean",
      description: "Install dependencies with frozen lock file",
    },
  }),
  run: async ({ args }) => {
    await (args._.length > 0 ? addDependency(args._, args) : installDependencies(args));
  },
});

const remove = defineCommand({
  meta: {
    name: "remove",
    description: "Remove dependencies",
  },
  args: defineArgs({
    name: {
      type: "positional",
      description: "Dependency name",
      required: true,
    },
    ...operationArgs,
  }),
  run: async ({ args }) => {
    await removeDependency(args._, args);
  },
});

const detect = defineCommand({
  meta: {
    name: "detect",
    description: "Detect the current package manager",
  },
  args: {
    cwd: {
      type: "string",
      description: "Current working directory",
    },
  },
  run: async ({ args }) => {
    const cwd = resolve(args.cwd || ".");
    const packageManager = await detectPackageManager(cwd);

    if (packageManager?.warnings) {
      for (const warning of packageManager.warnings) {
        consola.warn(warning);
      }
    }

    if (!packageManager) {
      consola.error(`Cannot detect package manager in \`${cwd}\``);
      return process.exit(1);
    }

    consola.log(
      `Detected package manager in \`${cwd}\`: \`${packageManager.name}@${packageManager.version}\``,
    );
  },
});

const dedupe = defineCommand({
  meta: {
    name: "dedupe",
    description: "Dedupe dependencies",
  },
  args: {
    cwd: {
      type: "string",
      description: "Current working directory",
    },
    silent: {
      type: "boolean",
      description: "Run in silent mode",
    },
    recreateLockFile: {
      type: "boolean",
      description: "Recreate lock file",
    },
  },
  run: async ({ args }) => {
    await dedupeDependencies(args);
  },
});

const run = defineCommand({
  meta: {
    name: "run",
    description: "Run script",
  },
  args: {
    name: {
      type: "positional",
      description: "Script name",
      required: true,
    },
    ...operationArgs,
  },
  run: async ({ args }) => {
    await runScript(args.name, args);
  },
});

export default defineCommand({
  meta: {
    name,
    version,
    description,
  },
  subCommands: {
    install,
    i: install,
    add: install,
    remove,
    rm: remove,
    uninstall: remove,
    un: remove,
    detect,
    dedupe,
    run,
  },
});

/* export default defineCommand({
  meta: {
    name: "pm",
    version: "1.0.0",
    description: "Unified package manager for all your projects. Usage example: `dler pm install`",
  },
  args: defineArgs({
    cwd: {
      type: "string",
      description: "Current working directory",
    },
    workspace: {
      type: "boolean",
      description: "Add to workspace",
    },
    silent: {
      type: "boolean",
      description: "Run in silent mode",
    },
    command: {
      type: "positional",
      description: "Command to run.",
      allowed: ["add", "rm", "latest"],
    },
    name: {
      type: "positional",
      description: "Dependency name",
      required: false,
    },
    dev: {
      type: "boolean",
      alias: "D",
      description: "Add as dev dependency",
    },
    global: {
      type: "boolean",
      alias: "g",
      description: "Add globally",
    },
    "frozen-lockfile": {
      type: "boolean",
      description: "Install dependencies with frozen lock file",
    },
  }),
  async run({ args }) {},
});
 */
