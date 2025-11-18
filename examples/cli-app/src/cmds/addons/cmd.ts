import { defineArgs, defineCommand } from "@reliverse/dler-launcher";
import { logger } from "@reliverse/dler-logger";
import { groupMultiselectPrompt } from "@reliverse/dler-prompt";

type Addon =
  | "pwa"
  | "tauri"
  | "starlight"
  | "biome"
  | "husky"
  | "ruler"
  | "turborepo"
  | "fumadocs"
  | "ultracite"
  | "oxlint"
  | "none";

type AddonOption = {
  value: Addon;
  label: string;
  hint: string;
};

const DEFAULT_ADDONS: Addon[] = ["turborepo"];

export default defineCommand({
  meta: {
    name: "addons",
    description: "Select project addons with grouped options",
    examples: ["cli-app addons"],
  },
  args: defineArgs({}),
  run: async () => {
    logger.log("📦 Project Addons Selection\n");

    const groupedOptions: Record<string, AddonOption[]> = {
      Documentation: [
        {
          value: "starlight",
          label: "Starlight",
          hint: "Documentation framework",
        },
        {
          value: "fumadocs",
          label: "Fumadocs",
          hint: "Next.js docs framework",
        },
      ],
      Linting: [
        { value: "biome", label: "Biome", hint: "Fast formatter and linter" },
        { value: "oxlint", label: "Oxlint", hint: "Rust-based linter" },
        { value: "ruler", label: "Ruler", hint: "Code quality tool" },
      ],
      Other: [
        { value: "pwa", label: "PWA", hint: "Progressive Web App support" },
        { value: "tauri", label: "Tauri", hint: "Desktop app framework" },
        { value: "husky", label: "Husky", hint: "Git hooks" },
        { value: "turborepo", label: "Turborepo", hint: "Monorepo tooling" },
        { value: "ultracite", label: "Ultracite", hint: "Build tool" },
        { value: "none", label: "None", hint: "No additional addons" },
      ],
    };

    const initialValues = DEFAULT_ADDONS.filter((addonValue) =>
      Object.values(groupedOptions).some((options) =>
        options.some((opt) => opt.value === addonValue),
      ),
    );

    logger.log("Select addons for your project:\n");

    const response = await groupMultiselectPrompt<Addon>({
      message: "Select addons",
      options: groupedOptions,
      initialValues,
      selectableGroups: false,
    });

    if (response === null) {
      logger.error("Selection cancelled");
      return;
    }

    if (response.length === 0) {
      logger.log("No addons selected.\n");
    } else {
      logger.success(`Selected addons: ${response.join(", ")}\n`);

      // Show selected addons grouped by category
      logger.log("Selected addons by category:\n");
      for (const [groupName, options] of Object.entries(groupedOptions)) {
        const selectedInGroup = response.filter((value) =>
          options.some((opt) => opt.value === value),
        );
        if (selectedInGroup.length > 0) {
          logger.log(`  ${groupName}:`);
          for (const value of selectedInGroup) {
            const option = options.find((opt) => opt.value === value);
            if (option) {
              logger.log(`    - ${option.label} (${option.hint})`);
            }
          }
          logger.log("");
        }
      }
    }

    logger.success("✅ Addon selection completed!");
  },
});
