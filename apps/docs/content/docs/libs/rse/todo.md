---
title: "rse todo"
description: "rse todo"
---

## rse todo

### todo: commands

- [ ]  run       ./my-script.ts       Execute a file with Bun
- [ ]            lint                 Run a package.json script
- [ ]  test                           Run unit tests with Bun
- [ ]  x         nuxi                 Execute a package binary (CLI), installing if needed (dler x)
- [ ]  repl                           Start a REPL session with Bun
- [ ]  exec                           Run a shell script directly with Bun
- [ ]  install                        Install dependencies for a package.json (dler i)
- [ ]  add       elysia               Add a dependency to package.json (dler a)
- [ ]  remove    backbone             Remove a dependency from package.json (dler rm)
- [ ]  update    @shumai/shumai       Update outdated dependencies
- [ ]  audit                          Check installed packages for vulnerabilities
- [ ]  outdated                       Display latest versions of outdated dependencies
- [ ]  link      [<package>]          Register or link a local npm package
- [ ]  unlink                         Unregister a local npm package
- [ ]  publish                        Publish a package(s) to the npm/jsr registry
- [ ]  patch <pkg>                    Prepare a package for patching
- [ ]  pm <subcommand>                Additional package management utilities
- [ ]  info      hono                 Display package metadata from the registry
- [ ]  build     ./a.ts ./b.jsx       Bundle TypeScript & JavaScript into a single file
- [ ]  init                           Start an empty project from a built-in template
- [ ]  create    next-app             Create a new project from a template (bun c)
- [ ]  upgrade                        Upgrade to latest version both of dler and your package manager.
- [x]  <command> --help               Print help text for command.

### todo: flag

- [ ]      --watch                         Automatically restart the process on file change
- [ ]      --hot                           Enable auto reload in the Bun runtime, test runner, or bundler
- [ ]      --no-clear-screen               Disable clearing the terminal screen on reload when --hot or --watch is enabled
- [ ]      --smol                          Use less memory, but run garbage collection more often
- [ ]  -r, --preload=<val>                 Import a module before other modules are loaded
- [ ]      --require=<val>                 Alias of --preload, for Node.js compatibility
- [ ]      --import=<val>                  Alias of --preload, for Node.js compatibility
- [ ]      --inspect=<val>                 Activate Bun's debugger
- [ ]      --inspect-wait=<val>            Activate Bun's debugger, wait for a connection before executing
- [ ]      --inspect-brk=<val>             Activate Bun's debugger, set breakpoint on first line of code and wait
- [ ]      --if-present                    Exit without an error if the entrypoint does not exist
- [ ]      --no-install                    Disable auto install in the Bun runtime
- [ ]      --install=<val>                 Configure auto-install behavior. One of "auto" (default, auto-installs when no node_modules), "fallback" (missing packages only), "force" (always).
- [ ]  -i                                  Auto-install dependencies during execution. Equivalent to --install=fallback.
- [ ]  -e, --eval=<val>                    Evaluate argument as a script
- [ ]  -p, --print=<val>                   Evaluate argument as a script and print the result
- [ ]      --prefer-offline                Skip staleness checks for packages in the Bun runtime and resolve from disk
- [ ]      --prefer-latest                 Use the latest matching versions of packages in the Bun runtime, always checking npm
- [ ]      --port=<val>                    Set the default port for Bun.serve
- [ ]      --conditions=<val>              Pass custom conditions to resolve
- [ ]      --fetch-preconnect=<val>        Preconnect to a URL while code is loading
- [ ]      --max-http-header-size=<val>    Set the maximum size of HTTP headers in bytes. Default is 16KiB
- [ ]      --dns-result-order=<val>        Set the default order of DNS lookup results. Valid orders: verbatim (default), ipv4first, ipv6first
- [ ]      --expose-gc                     Expose gc() on the global object. Has no effect on Bun.gc().
- [ ]      --no-deprecation                Suppress all reporting of the custom deprecation.
- [ ]      --throw-deprecation             Determine whether or not deprecation warnings result in errors.
- [ ]      --title=<val>                   Set the process title
- [ ]      --zero-fill-buffers             Boolean to force Buffer.allocUnsafe(size) to be zero-filled.
- [ ]      --redis-preconnect              Preconnect to $REDIS_URL at startup
- [ ]      --sql-preconnect                Preconnect to PostgreSQL at startup
- [ ]      --no-addons                     Throw an error if process.dlopen is called, and disable export condition "node-addons"
- [ ]      --unhandled-rejections=<val>    One of "strict", "throw", "warn", "none", or "warn-with-error-code"
- [ ]      --console-depth=<val>           Set the default depth for console.log object inspection (default: 2)
- [ ]      --silent                        Don't print the script command
- [ ]      --elide-lines=<val>             Number of lines of script output shown when using --filter (default: 10). Set to 0 to show all lines.
- [ ]  -v, --version                       Print version and exit
- [ ]      --revision                      Print version with revision and exit
- [ ]  -F, --filter=<val>                  Run a script in all workspace packages matching the pattern
- [ ]  -b, --bun                           Force a script or package to use Bun's runtime instead of Node.js (via symlinking node)
- [ ]      --shell=<val>                   Control the shell used for package.json scripts. Supports either 'bun' or 'system'
- [ ]      --env-file=<val>                Load environment variables from the specified file(s)
- [ ]      --cwd=<val>                     Absolute path to resolve files & entry points from. This just changes the process' cwd.
- [ ]  -c, --config=<val>                  Specify path to Bun config file. Default $cwd/bunfig.toml
- [ ]  -h, --help                          Display this menu and exit
