import path from "node:path";
import { re } from "@reliverse/relico";
import fs from "@reliverse/relifso";
import { relinka } from "@reliverse/relinka";
import {
  cancel,
  createSpinner,
  inputPrompt,
  isCancel,
} from "@reliverse/rempts";
import { execa } from "execa";
import {
  addEnvVariablesToFile,
  type EnvVariable,
} from "~/impl/providers/better-t-stack/helpers/project-generation/env-setup";
import type { ProjectConfig } from "~/impl/providers/better-t-stack/types";
import { commandExists } from "~/impl/providers/better-t-stack/utils/command-exists";

interface MongoDBConfig {
  connectionString: string;
}

async function checkAtlasCLI(): Promise<boolean> {
  const s = createSpinner({
    text: "Checking for MongoDB Atlas CLI...",
  });
  s.start("Checking for MongoDB Atlas CLI...");

  try {
    const exists = await commandExists("atlas");
    if (exists) s.succeed("MongoDB Atlas CLI found");
    else s.fail(re.yellow("MongoDB Atlas CLI not found"));
    return exists;
  } catch (_error) {
    s.fail(re.red("Error checking MongoDB Atlas CLI"));
    return false;
  }
}

async function initMongoDBAtlas(
  serverDir: string,
): Promise<MongoDBConfig | null> {
  try {
    const hasAtlas = await checkAtlasCLI();

    if (!hasAtlas) {
      relinka("error", re.red("MongoDB Atlas CLI not found."));
      relinka(
        "info",
        re.yellow(
          "Please install it from: https://www.mongodb.com/docs/atlas/cli/current/install-atlas-cli/",
        ),
      );
      return null;
    }

    relinka("info", re.blue("Running MongoDB Atlas setup..."));

    await execa("atlas", ["deployments", "setup"], {
      cwd: serverDir,
      stdio: "inherit",
    });

    relinka("info", re.green("MongoDB Atlas deployment ready"));

    const connectionString = await inputPrompt({
      message: "Enter your MongoDB connection string:",
      placeholder:
        "mongodb+srv://username:password@cluster.mongodb.net/database",
      validate(value) {
        /* error:
         */
        if (!value) return "Please enter a connection string";
        if (!value.startsWith("mongodb")) {
          return "URL should start with mongodb:// or mongodb+srv://";
        }
        return true;
      },
    });

    if (isCancel(connectionString)) {
      cancel("MongoDB setup cancelled");
      return null;
    }

    return {
      connectionString: connectionString as string,
    };
  } catch (error) {
    if (error instanceof Error) {
      relinka("error", re.red(error.message));
    }
    return null;
  }
}

async function writeEnvFile(projectDir: string, config?: MongoDBConfig) {
  try {
    const envPath = path.join(projectDir, "apps/server", ".env");
    const variables: EnvVariable[] = [
      {
        key: "DATABASE_URL",
        value: config?.connectionString ?? "mongodb://localhost:27017/mydb",
        condition: true,
      },
    ];
    await addEnvVariablesToFile(envPath, variables);
  } catch (_error) {
    relinka("error", "Failed to update environment configuration");
    return;
  }
}

function displayManualSetupInstructions() {
  relinka(
    "info",
    `
${re.green("MongoDB Atlas Manual Setup Instructions:")}

1. Install Atlas CLI:
   ${re.blue("https://www.mongodb.com/docs/atlas/cli/stable/install-atlas-cli/")}

2. Run the following command and follow the prompts:
   ${re.blue("atlas deployments setup")}

3. Get your connection string from the Atlas dashboard:
   Format: ${re.dim("mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE_NAME")}

4. Add the connection string to your .env file:
   ${re.dim('DATABASE_URL="your_connection_string"')}
`,
  );
}

export async function setupMongoDBAtlas(config: ProjectConfig) {
  const { projectDir } = config;
  const mainSpinner = createSpinner({
    text: "Setting up MongoDB Atlas...",
  });
  mainSpinner.start("Setting up MongoDB Atlas...");

  const serverDir = path.join(projectDir, "apps/server");
  try {
    await fs.ensureDir(serverDir);

    mainSpinner.succeed("MongoDB Atlas setup ready");

    const config = await initMongoDBAtlas(serverDir);

    if (config) {
      await writeEnvFile(projectDir, config);
      relinka(
        "success",
        re.green(
          "MongoDB Atlas setup complete! Connection saved to .env file.",
        ),
      );
    } else {
      relinka("warn", re.yellow("Falling back to local MongoDB configuration"));
      await writeEnvFile(projectDir);
      displayManualSetupInstructions();
    }
  } catch (error) {
    mainSpinner.fail(re.red("MongoDB Atlas setup failed"));
    relinka(
      "error",
      re.red(
        `Error during MongoDB Atlas setup: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ),
    );

    try {
      await writeEnvFile(projectDir);
      displayManualSetupInstructions();
    } catch {}
  }
}
