import { re } from "@reliverse/relico";
import { cancel, isCancel, select } from "@reliverse/rempts";

import type {
  API,
  Backend,
  Frontend,
} from "~/impl/providers/better-t-stack/types";

export async function getApiChoice(
  Api?: API,
  frontend?: Frontend[],
  backend?: Backend,
): Promise<API> {
  if (backend === "convex" || backend === "none") {
    return "none";
  }

  if (Api) return Api;

  const includesSolid = frontend?.includes("solid");

  let apiOptions = [
    {
      value: "trpc" as const,
      label: "tRPC",
      hint: "End-to-end typesafe APIs made easy",
    },
    {
      value: "orpc" as const,
      label: "oRPC",
      hint: "End-to-end type-safe APIs that adhere to OpenAPI standards",
    },
    {
      value: "none" as const,
      label: "None",
      hint: "No API layer (e.g. for full-stack frameworks like Next.js with Route Handlers)",
    },
  ];

  if (includesSolid) {
    apiOptions = [
      {
        value: "orpc" as const,
        label: "oRPC",
        hint: ``,
      },
      {
        value: "none" as const,
        label: "None",
        hint: "No API layer",
      },
    ];
  }

  const apiType = await select<API>({
    message: "Select API type",
    options: apiOptions,
    initialValue: apiOptions[0]?.value ?? "none",
  });

  if (isCancel(apiType)) {
    cancel(re.red("Operation cancelled"));
    process.exit(0);
  }

  return apiType;
}
