/**
 * 👉 `dler rempts init --cmds`
 *
 * @example
 * ```ts
 * import { cmdAgg } from "~/app/cmds";
 * await runCmd(await cmdAgg(), [
 *   `--imports=${imports}`,
 *   `--input=${input}`,
 *   `--named=${named}`,
 *   `--out=${out}`,
 *   `--recursive=${recursive}`,
 *   `--strip=${strip}`,
 * ]);
 */

export async function cmdRelifsoInit() {
  return (await import("./relifso/init/cmd")).default;
}

export async function cmdInjectExpect() {
  return (await import("./inject/expect/cmd")).default;
}

export async function cmdAgg() {
  return (await import("./agg/cmd")).default;
}

export async function cmdBuild() {
  return (await import("./build/cmd")).default;
}

export async function cmdPub() {
  return (await import("./pub/cmd")).default;
}

export async function cmdRelifsoRename() {
  return (await import("./relifso/rename/cmd")).default;
}

export async function cmdMigrate() {
  return (await import("./migrate/cmd")).default;
}
