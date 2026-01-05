#!/usr/bin/env bun
import { createCLI } from '@reliverse/rempts-core'
import greetCommand from './commands/greet'

const cli = await createCLI()

cli.command(greetCommand)
await cli.run()