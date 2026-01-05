# Monorepo Project

This is an Bun monorepo with TypeScript. The project uses bun workspaces for package management.
The project uses Turborepo for task local & remote caching. Every submodule of this monorepo,
may include its own `AGENTS.md` file, which you must adhere to.

## Project Structure

- `packages/` - Contains all workspace packages (relico, tsconfig, etc)
- `apps/` - Application definitions split by service (cli, scripts, etc)

## Code Standards

- Use TypeScript with strict mode enabled
- Import shared modules using workspace names, ie. `@reliverse/relico`
- Be careful of circular dependencies, `apps` may rely on `packages`, not the other way around
- Prefer single word variable/function names
- Avoid `try {} catch() {}` where possible, prefer to let exceptions bubble up
- Avoid `else` statements where possible
- Do not make useless helper functions, inline functionality unless the function is reusable or composable
- Prefer early returns over nested `if` statements

## Dler Rules

- This project uses `@reliverse/dler` to manage bun monorepos easily
- You can check dler's available commands with `dler --help`
- Use only latest versions of dependencies
- Use `dler update` to update all dependencies in monorepo

## Where to find information

Read README.md to learn comprehensive information about the project.
