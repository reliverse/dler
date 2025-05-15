// 👉 `dler rempts init --cmds`

export async function getCmdRelifsoInit() {
  return (await import("./relifso/init/cmd.js")).default;
}

export async function getCmdInjectTsExpectError() {
  return (await import("./inject/expect/cmd.js")).default;
}
