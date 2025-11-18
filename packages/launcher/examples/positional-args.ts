// Example: Using positional arguments with the launcher

import { defineArgs, defineCommand } from "@reliverse/dler-launcher";

/**
 * Example 1: Command with positional arguments
 * Usage: dler copy <source> <destination> [--verbose]
 * Can be used as: dler copy src.txt dest.txt
 *            or: dler copy --source src.txt --destination dest.txt
 *            or: dler copy src.txt dest.txt --verbose
 */
export const copyCommand = defineCommand({
  meta: {
    name: "copy",
    description: "Copy files from source to destination",
    version: "1.0.0",
    examples: [
      "copy src/index.ts dist/index.ts",
      "copy --source src/index.ts --destination dist/index.ts",
      "copy src/index.ts dist/index.ts --verbose",
    ],
  },
  args: defineArgs({
    source: {
      type: "string",
      description: "Source file path",
      required: true,
      positional: true,
    },
    destination: {
      type: "string",
      description: "Destination file path",
      required: true,
      positional: true,
    },
    verbose: {
      type: "boolean",
      description: "Enable verbose output",
      aliases: ["v"],
    },
  }),
  run: async ({ args }) => {
    console.log(`Copying from ${args.source} to ${args.destination}`);
    if (args.verbose) {
      console.log("Verbose mode enabled");
    }
  },
});

/**
 * Example 2: Command with optional positional arguments
 * Usage: dler process [input] [--format json|csv] [--output file]
 * Can be used as: dler process
 *            or: dler process data.json
 *            or: dler process data.json --format csv
 *            or: dler process --input data.json --format csv --output result.csv
 */
export const processCommand = defineCommand({
  meta: {
    name: "process",
    description: "Process data with optional input file",
    examples: [
      "process",
      "process data.json",
      "process data.json --format csv --output output.csv",
      "process --input data.json --format csv --output output.csv",
    ],
  },
  args: defineArgs({
    input: {
      type: "string",
      description: "Input file path (optional)",
      positional: true,
    },
    format: {
      type: "string",
      description: "Output format",
      default: "json",
      allowed: ["json", "csv"],
    },
    output: {
      type: "string",
      description: "Output file path",
    },
  }),
  run: async ({ args }) => {
    if (args.input) {
      console.log(`Processing ${args.input} as ${args.format}`);
    } else {
      console.log(`Processing stdin as ${args.format}`);
    }

    if (args.output) {
      console.log(`Output will be saved to ${args.output}`);
    }
  },
});

/**
 * Example 3: Command with mixed positional and flag arguments
 * Usage: dler convert <value> [output] [--type string|number] [--validate]
 * Can be used as: dler convert "hello"
 *            or: dler convert "hello" output.txt
 *            or: dler convert "42" --type number --validate
 *            or: dler convert --value "42" --type number --validate
 */
export const convertCommand = defineCommand({
  meta: {
    name: "convert",
    description: "Convert data with type validation",
    examples: [
      'convert "hello"',
      'convert "hello" output.txt',
      'convert "42" --type number --validate',
      'convert --value "42" --type number --validate',
    ],
  },
  args: defineArgs({
    value: {
      type: "string",
      description: "Input value to convert",
      required: true,
      positional: true,
    },
    output: {
      type: "string",
      description: "Output file path (optional)",
      positional: true,
    },
    type: {
      type: "string",
      description: "Target type for conversion",
      default: "string",
      allowed: ["string", "number"],
    },
    validate: {
      type: "boolean",
      description: "Enable validation",
      aliases: ["v"],
    },
  }),
  run: async ({ args }) => {
    console.log(`Converting "${args.value}" to ${args.type}`);

    if (args.validate) {
      console.log("Validation enabled");
    }

    if (args.output) {
      console.log(`Saving result to ${args.output}`);
    }
  },
});

/**
 * Example 4: Command with numeric positional arguments
 * Usage: dler calculate <a> <b> [--operation add|multiply]
 * Can be used as: dler calculate 10 20
 *            or: dler calculate 10 20 --operation multiply
 *            or: dler calculate --a 10 --b 20 --operation divide
 */
export const calculateCommand = defineCommand({
  meta: {
    name: "calculate",
    description: "Perform mathematical operations",
    examples: ["calculate 10 20", "calculate 10 20 --operation multiply"],
  },
  args: defineArgs({
    a: {
      type: "number",
      description: "First number",
      required: true,
      positional: true,
    },
    b: {
      type: "number",
      description: "Second number",
      required: true,
      positional: true,
    },
    operation: {
      type: "string",
      description: "Operation to perform",
      default: "add",
      allowed: ["add", "multiply", "divide"],
    },
  }),
  run: async ({ args }) => {
    let result: number;
    switch (args.operation) {
      case "multiply":
        result = args.a * args.b;
        break;
      case "divide":
        result = args.a / args.b;
        break;
      case "add":
      default:
        result = args.a + args.b;
    }

    console.log(`${args.a} ${args.operation} ${args.b} = ${result}`);
  },
});
