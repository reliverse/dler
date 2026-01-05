# @reliverse/rempts-utils

Utility functions for building CLI applications with Rempts.

## Installation

```bash
bun add @reliverse/rempts-utils
```

## Features

- 🎨 **Colors** - Terminal colors and styling
- 💬 **Prompts** - Interactive prompts and confirmations
- ⏳ **Spinners** - Loading indicators
- 📋 **Formatting** - Tables, lists, and text formatting
- 🔍 **Validation** - Input validation helpers

## Usage

### Colors

Style your terminal output:

```typescript
import { colors } from '@reliverse/rempts-utils'

console.log(relico.green('✓ Success!'))
console.log(relico.red('✗ Error!'))
console.log(relico.blue('ℹ Info'))
console.log(relico.yellow('⚠ Warning'))
console.log(relico.bold('Bold text'))
console.log(relico.dim('Dimmed text'))
```

### Prompts

Interactive user input:

```typescript
import { prompt, confirm, select } from '@reliverse/rempts-utils'

// Text input
const name = await prompt({
  message: 'What is your name?',
  default: 'Anonymous',
  validate: (value) => value.length > 0
})

// Confirmation
const proceed = await confirm({
  message: 'Do you want to continue?',
  default: true
})

// Selection
const choice = await select({
  message: 'Choose your favorite framework',
  options: [
    { label: 'Bun', value: 'bun' },
    { label: 'Node.js', value: 'node' },
    { label: 'Deno', value: 'deno' }
  ]
})
```

### Spinners

Show progress for long-running tasks:

```typescript
import { spinner } from '@reliverse/rempts-utils'

const spin = spinner()
spin.start('Loading...')

// Do some work
await someAsyncTask()

spin.success('Done!')
// or
spin.error('Failed!')
// or
spin.stop()
```

### Tables

Display structured data:

```typescript
import { table } from '@reliverse/rempts-utils'

const data = [
  { name: 'John', age: 30, city: 'New York' },
  { name: 'Jane', age: 25, city: 'London' },
  { name: 'Bob', age: 35, city: 'Paris' }
]

console.log(table(data))
```

### Lists

Format lists with bullets or numbers:

```typescript
import { list } from '@reliverse/rempts-utils'

// Bullet list
console.log(list([
  'First item',
  'Second item',
  'Third item'
]))

// Numbered list
console.log(list([
  'First step',
  'Second step',
  'Third step'
], { ordered: true }))
```

## API Reference

### Colors
- `relico.red(text)` - Red text
- `relico.green(text)` - Green text
- `relico.blue(text)` - Blue text
- `relico.yellow(text)` - Yellow text
- `relico.cyan(text)` - Cyan text
- `relico.magenta(text)` - Magenta text
- `relico.bold(text)` - Bold text
- `relico.dim(text)` - Dimmed text
- `relico.underline(text)` - Underlined text

### Prompts
- `prompt(options)` - Text input prompt
- `confirm(options)` - Yes/no confirmation
- `select(options)` - Single selection from list
- `multiselect(options)` - Multiple selection from list

### Spinners
- `spinner(options)` - Create a new spinner instance
- `spinner.start(message)` - Start spinning with message
- `spinner.success(message)` - Stop with success message
- `spinner.error(message)` - Stop with error message
- `spinner.stop()` - Stop spinning

### Formatting
- `table(data, options)` - Format data as table
- `list(items, options)` - Format items as list
- `tree(data, options)` - Format hierarchical data as tree

## License

MIT © blefnk
