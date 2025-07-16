import cp from "node:child_process";

import enoent from "./exec-enoent";
import parse from "./exec-parse";

function spawn(command, args, options) {
  // Parse the arguments
  const parsed = parse(command, args, options);

  // Spawn the child process
  const spawned = cp.spawn(parsed.command, parsed.args, parsed.options);

  // Hook into child process "exit" event to emit an error if the command does not exists
  enoent.hookChildProcess(spawned, parsed);

  return spawned;
}

function spawnSync(command, args, options) {
  // Parse the arguments
  const parsed = parse(command, args, options);

  // Spawn the child process
  const result = cp.spawnSync(parsed.command, parsed.args, parsed.options);

  // Analyze if the command does not exist
  result.error = result.error || enoent.verifyENOENTSync(result.status, parsed);

  return result;
}

module.exports = spawn;
module.exports.spawn = spawn;
module.exports.sync = spawnSync;

module.exports._enoent = enoent;
