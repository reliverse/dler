import { cancel, isCancel, selectSimple } from "@reliverse/rempts";
import { execaCommand } from "execa";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

import { checkPackageManagers } from "../utils/check-package-managers";
import { generateSecretHash } from "../utils/generate-secret";
import type { AuthConfigImport } from "./types";

// import { parse } from "dotenv";

/**
 * Should only use any database that is core DBs, and supports the Better Auth CLI generate functionality.
 */
export const supportedDatabases = [
  // Built-in kysely
  "sqlite",
  "mysql",
  "mssql",
  "postgres",
  // Drizzle
  "drizzle:pg",
  "drizzle:mysql",
  "drizzle:sqlite",
  // Prisma
  "prisma:postgresql",
  "prisma:mysql",
  "prisma:sqlite",
  // Mongo
  "mongodb",
] as const;

export type SupportedDatabases = (typeof supportedDatabases)[number];

export const supportedPlugins = [
  {
    id: "two-factor",
    name: "twoFactor",
    path: `better-auth/plugins`,
    clientName: "twoFactorClient",
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "username",
    name: "username",
    clientName: "usernameClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "anonymous",
    name: "anonymous",
    clientName: "anonymousClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "phone-number",
    name: "phoneNumber",
    clientName: "phoneNumberClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "magic-link",
    name: "magicLink",
    clientName: "magicLinkClient",
    clientPath: "better-auth/client/plugins",
    path: `better-auth/plugins`,
  },
  {
    id: "email-otp",
    name: "emailOTP",
    clientName: "emailOTPClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "passkey",
    name: "passkey",
    clientName: "passkeyClient",
    path: `better-auth/plugins/passkey`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "generic-oauth",
    name: "genericOAuth",
    clientName: "genericOAuthClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "one-tap",
    name: "oneTap",
    clientName: "oneTapClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "api-key",
    name: "apiKey",
    clientName: "apiKeyClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "admin",
    name: "admin",
    clientName: "adminClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "organization",
    name: "organization",
    clientName: "organizationClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "oidc",
    name: "oidcProvider",
    clientName: "oidcClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "sso",
    name: "sso",
    clientName: "ssoClient",
    path: `better-auth/plugins/sso`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "bearer",
    name: "bearer",
    clientName: undefined,
    path: `better-auth/plugins`,
    clientPath: undefined,
  },
  {
    id: "multi-session",
    name: "multiSession",
    clientName: "multiSessionClient",
    path: `better-auth/plugins`,
    clientPath: "better-auth/client/plugins",
  },
  {
    id: "oauth-proxy",
    name: "oAuthProxy",
    clientName: undefined,
    path: `better-auth/plugins`,
    clientPath: undefined,
  },
  {
    id: "open-api",
    name: "openAPI",
    clientName: undefined,
    path: `better-auth/plugins`,
    clientPath: undefined,
  },
  {
    id: "jwt",
    name: "jwt",
    clientName: undefined,
    clientPath: undefined,
    path: `better-auth/plugins`,
  },
  {
    id: "next-cookies",
    name: "nextCookies",
    clientPath: undefined,
    clientName: undefined,
    path: `better-auth/next-js`,
  },
] as const;

export type SupportedPlugin = (typeof supportedPlugins)[number];

export async function formatWithBiome(
  code: string,
  _filepath: string,
): Promise<string> {
  const tempFile = path.join(process.cwd(), `.temp-${Date.now()}.ts`);
  try {
    await fs.writeFile(tempFile, code);
    await execaCommand(`bun x biome format --write ${tempFile}`);
    const formatted = await fs.readFile(tempFile, "utf-8");
    return formatted;
  } finally {
    await fs.unlink(tempFile).catch(() => {});
  }
}

export const getDefaultAuthConfig = async ({ appName }: { appName?: string }) =>
  await formatWithBiome(
    [
      "import { betterAuth } from 'better-auth';",
      "",
      "export const auth = betterAuth({",
      appName ? `appName: "${appName}",` : "",
      "plugins: [],",
      "});",
    ].join("\n"),
    "auth.ts",
  );

export type SupportedFrameworks =
  | "vanilla"
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "nextjs";

export const getDefaultAuthClientConfig = async ({
  auth_config_path,
  framework,
  clientPlugins,
}: {
  framework: SupportedFrameworks;
  auth_config_path: string;
  clientPlugins: {
    id: string;
    name: string;
    contents: string;
    imports: AuthConfigImport[];
  }[];
}) => {
  function groupImportVariables(): AuthConfigImport[] {
    const result: AuthConfigImport[] = [
      {
        path: "better-auth/client/plugins",
        variables: [{ name: "inferAdditionalFields" }],
      },
    ];
    for (const plugin of clientPlugins) {
      for (const import_ of plugin.imports) {
        if (Array.isArray(import_.variables)) {
          for (const variable of import_.variables) {
            const existingIndex = result.findIndex(
              (x) => x.path === import_.path,
            );
            if (existingIndex !== -1) {
              const vars = result[existingIndex]!.variables;
              if (Array.isArray(vars)) {
                vars.push(variable);
              } else {
                result[existingIndex]!.variables = [vars, variable];
              }
            } else {
              result.push({
                path: import_.path,
                variables: [variable],
              });
            }
          }
        } else {
          const existingIndex = result.findIndex(
            (x) => x.path === import_.path,
          );
          if (existingIndex !== -1) {
            const vars = result[existingIndex]!.variables;
            if (Array.isArray(vars)) {
              vars.push(import_.variables);
            } else {
              result[existingIndex]!.variables = [vars, import_.variables];
            }
          } else {
            result.push({
              path: import_.path,
              variables: [import_.variables],
            });
          }
        }
      }
    }
    return result;
  }
  const imports = groupImportVariables();
  let importString = "";
  for (const import_ of imports) {
    if (Array.isArray(import_.variables)) {
      importString += `import { ${import_.variables
        .map(
          (x) =>
            `${x.asType ? "type " : ""}${x.name}${x.as ? ` as ${x.as}` : ""}`,
        )
        .join(", ")} } from "${import_.path}";\n`;
    } else {
      importString += `import ${import_.variables.asType ? "type " : ""}${
        import_.variables.name
      }${import_.variables.as ? ` as ${import_.variables.as}` : ""} from "${import_.path}";\n`;
    }
  }

  const formattedCode = await formatWithBiome(
    [
      `import { createAuthClient } from "better-auth/${
        framework === "nextjs"
          ? "react"
          : framework === "vanilla"
            ? "client"
            : framework
      }";`,
      `import type { auth } from "${auth_config_path}";`,
      importString,
      ``,
      `export const authClient = createAuthClient({`,
      `baseURL: "http://localhost:3000",`,
      `plugins: [inferAdditionalFields<typeof auth>(),${clientPlugins
        .map((x) => `${x.name}(${x.contents})`)
        .join(", ")}],`,
      `});`,
    ].join("\n"),
    "auth-client.ts",
  );

  return formattedCode;
};

export const optionsSchema = z.object({
  cwd: z.string(),
  config: z.string().optional(),
  database: z.enum(supportedDatabases).optional(),
  "skip-db": z.boolean().optional(),
  "skip-plugins": z.boolean().optional(),
  "package-manager": z.string().optional(),
  tsconfig: z.string().optional(),
});

export const outroText = `🥳 All Done, Happy Hacking!`;

export async function getLatestNpmVersion(
  packageName: string,
): Promise<string> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);

    if (!response.ok) {
      throw new Error(`Package not found: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      "dist-tags": { latest: string };
    };
    return data["dist-tags"].latest; // Get the latest version from dist-tags
  } catch (error: any) {
    throw error?.message;
  }
}

export async function getPackageManager() {
  const { hasBun, hasPnpm } = await checkPackageManagers();
  if (!hasBun && !hasPnpm) return "npm";

  const packageManagerOptions: {
    value: "bun" | "pnpm" | "yarn" | "npm";
    label?: string;
    hint?: string;
  }[] = [];

  if (hasPnpm) {
    packageManagerOptions.push({
      value: "pnpm",
      label: "pnpm",
      hint: "recommended",
    });
  }
  if (hasBun) {
    packageManagerOptions.push({
      value: "bun",
      label: "bun",
    });
  }
  packageManagerOptions.push({
    value: "npm",
    hint: "not recommended",
  });

  const packageManager = await selectSimple({
    message: "Choose a package manager",
    options: packageManagerOptions,
  });
  if (isCancel(packageManager)) {
    cancel(`Operation cancelled.`);
    process.exit(0);
  }
  return packageManager;
}

export async function getEnvFiles(cwd: string): Promise<string[]> {
  const files = await fs.readdir(cwd);
  return files.filter((x) => x.startsWith(".env"));
}

export async function updateEnvs({
  envs,
  files,
  isCommented,
}: {
  /**
   * The ENVs to append to the file
   */
  envs: string[];
  /**
   * Full file paths
   */
  files: string[];
  /**
   * Weather to comment the all of the envs or not
   */
  isCommented: boolean;
}): Promise<void> {
  let previouslyGeneratedSecret: string | null = null;
  for (const file of files) {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split("\n");
    const newLines = envs.map(
      (x) =>
        `${isCommented ? "# " : ""}${x}=${getEnvDescription(x) ?? `"some_value"`}`,
    );
    newLines.push("");
    newLines.push(...lines);
    await fs.writeFile(file, newLines.join("\n"), "utf8");
  }

  function getEnvDescription(env: string) {
    if (env === "DATABASE_HOST") {
      return `"The host of your database"`;
    }
    if (env === "DATABASE_PORT") {
      return `"The port of your database"`;
    }
    if (env === "DATABASE_USER") {
      return `"The username of your database"`;
    }
    if (env === "DATABASE_PASSWORD") {
      return `"The password of your database"`;
    }
    if (env === "DATABASE_NAME") {
      return `"The name of your database"`;
    }
    if (env === "DATABASE_URL") {
      return `"The URL of your database"`;
    }
    if (env === "BETTER_AUTH_SECRET") {
      previouslyGeneratedSecret =
        previouslyGeneratedSecret ?? generateSecretHash();
      return `"${previouslyGeneratedSecret}"`;
    }
    if (env === "BETTER_AUTH_URL") {
      return `"http://localhost:3000" # Your APP URL`;
    }
  }
}
