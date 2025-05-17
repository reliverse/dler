// 👉 `dler rempts init --cmds`

export async function cmdRelifsoInit() {
  return (await import("./relifso/init/cmd.js")).default;
}

export async function cmdInjectExpect() {
  return (await import("./inject/expect/cmd.js")).default;
}

export async function cmdAgg() {
  return (await import("./agg/cmd.js")).default;
}

export async function cmdBuild() {
  return (await import("./build/cmd.js")).default;
}

export async function cmdPub() {
  return (await import("./pub/cmd.js")).default;
}
