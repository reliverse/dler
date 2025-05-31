import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import { defineArgs, defineCommand } from "@reliverse/rempts";

import type { Spell } from "~/libs/sdk/sdk-impl/spell/spell-types";

import { executeSpell } from "~/libs/sdk/sdk-mod";

/*
This command is planned to be a converter for different tasks.
Currently it is only a `dler spell` wrapper.

At the moment the command:
1. Validates input paths and required arguments
2. Creates appropriate spells based on the operation type
3. Reads file content
4. Executes the spell using the SDK's `executeSpell` function
5. Shows the results, including any changes made to the file

1. Replace text in files:
```bash
dler conv --type replace --input file.txt --pattern "old text" --replacement "new text"
```

2. Rename files:
```bash
dler conv --type rename --input old.txt --output new.txt
```

3. Remove comments:
```bash
dler conv --type remove-comment --input file.ts --pattern "//.*"
```

4. Remove lines:
```bash
dler conv --type remove-line --input file.txt --pattern ".*TODO.*"
```

5. Remove files:
```bash
dler conv --type remove-file --input file.txt
```

6. Copy files:
```bash
dler conv --type copy --input source.txt --output dest.txt
```

7. Move files:
```bash
dler conv --type move --input source.txt --output dest.txt
```

8. Transform content:
```bash
dler conv --type transform --input file.txt --transform "myTransformFunction"
```

9. Insert text at a specific line:
```bash
dler conv --type insert --input file.txt --line 10 --replacement "new line"
```
*/
export default defineCommand({
  meta: {
    name: "conv",
    version: "1.0.0",
    description: "Convert files using various SDK converters.",
  },
  args: defineArgs({
    type: {
      type: "string",
      required: true,
      description:
        "Type of conversion to perform (replace, rename, remove-comment, remove-line, remove-file, copy, move, transform, insert)",
    },
    input: {
      type: "string",
      required: true,
      description: "Input file or directory path",
    },
    output: {
      type: "string",
      description:
        "Output file or directory path (required for copy/move/rename operations)",
    },
    pattern: {
      type: "string",
      description: "Pattern to match (for replace/remove operations)",
    },
    replacement: {
      type: "string",
      description: "Replacement text (for replace/insert operations)",
    },
    line: {
      type: "number",
      description: "Line number (for insert/remove-line operations)",
    },
    transform: {
      type: "string",
      description: "Transform function name (for transform operation)",
    },
  }),
  async run({ args }) {
    const { type, input, output, pattern, replacement, line, transform } = args;

    // Validate input path exists
    if (!(await fs.pathExists(input))) {
      relinka("error", `❌ Input path does not exist: ${input}`);
      return;
    }

    // Create appropriate spell based on type
    let spell: Spell;
    switch (type) {
      case "replace":
        if (!pattern || !replacement) {
          relinka(
            "error",
            "❌ Pattern and replacement are required for replace operation",
          );
          return;
        }
        spell = {
          type: "replace-line",
          params: { hooked: false },
          value: replacement,
          fullMatch: pattern,
        };
        break;

      case "rename":
        if (!output) {
          relinka("error", "❌ Output path is required for rename operation");
          return;
        }
        spell = {
          type: "rename-file",
          params: { hooked: false },
          fileName: output,
        };
        break;

      case "remove-comment":
        if (!pattern) {
          relinka(
            "error",
            "❌ Pattern is required for remove-comment operation",
          );
          return;
        }
        spell = {
          type: "remove-comment",
          params: { hooked: false },
          fullMatch: pattern,
        };
        break;

      case "remove-line":
        if (!pattern) {
          relinka("error", "❌ Pattern is required for remove-line operation");
          return;
        }
        spell = {
          type: "remove-line",
          params: { hooked: false },
          fullMatch: pattern,
        };
        break;

      case "remove-file":
        spell = {
          type: "remove-file",
          params: { hooked: false },
        };
        break;

      case "copy":
        if (!output) {
          relinka("error", "❌ Output path is required for copy operation");
          return;
        }
        spell = {
          type: "copy-file",
          params: { hooked: false },
          fileName: output,
        };
        break;

      case "move":
        if (!output) {
          relinka("error", "❌ Output path is required for move operation");
          return;
        }
        spell = {
          type: "move-file",
          params: { hooked: false },
          fileName: output,
        };
        break;

      case "transform":
        if (!transform) {
          relinka(
            "error",
            "❌ Transform function name is required for transform operation",
          );
          return;
        }
        spell = {
          type: "transform-content",
          params: { hooked: false },
          value: transform,
        };
        break;

      case "insert":
        if (!line || !replacement) {
          relinka(
            "error",
            "❌ Line number and replacement are required for insert operation",
          );
          return;
        }
        spell = {
          type: "insert-at",
          params: { hooked: false },
          value: replacement,
          lineNumber: line,
        };
        break;

      default:
        relinka("error", `❌ Unknown conversion type: ${type}`);
        return;
    }

    try {
      // Read file content
      const content = await fs.readFile(input, "utf-8");

      // Execute the spell
      const result = await executeSpell(spell, input, content);

      if (result.success) {
        relinka(
          "log",
          `✅ Successfully performed ${type} operation on ${input}`,
        );
        if (result.changes) {
          relinka(
            "log",
            `📝 Changes:\nBefore: ${result.changes.before}\nAfter: ${result.changes.after}`,
          );
        }
      } else {
        relinka(
          "error",
          `❌ Failed to perform ${type} operation: ${result.message}`,
        );
      }
    } catch (error) {
      relinka("error", `❌ Error during conversion: ${error}`);
    }
  },
});
