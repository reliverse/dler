# @reliverse/dler-prompt

@reliverse/dler-prompt is a terminal prompt library.

## Install

```bash
bun add @reliverse/dler-prompt
```

## Usage

### selectPrompt

The `selectPrompt` function lets you create a terminal single-selection list prompt. It provides the functions of page up and down and key movement, and supports custom rendering methods.

```js
import { selectPrompt } from '@reliverse/dler-prompt'

const result = selectPrompt([
  { text: 'feat', description: 'Introducing new features' },
  { text: 'fix', description: 'Bug fix' },
  { text: 'docs', description: 'Writing docs' },
  { text: 'style', description: 'Improving structure/format of the code' },
  { text: 'refactor', description: 'Refactoring code' },
  { text: 'test', description: 'Refactoring code' },
  { text: 'chore', description: 'When adding missing tests' },
  { text: 'perf', description: 'Improving performance' }
], {
  headerText: 'Select Commit Type: ',
  perPage: 5,
  footerText: 'Footer here'
})

console.log(result)
// { selectedIndex: 2, error: null }
```

### multiselectPrompt

The `multiselectPrompt` function lets you create a terminal multi-selection list prompt. Use Space to toggle selections and Enter to confirm.

```js
import { multiselectPrompt } from '@reliverse/dler-prompt'

const result = multiselectPrompt([
  { text: 'feat', description: 'Introducing new features' },
  { text: 'fix', description: 'Bug fix' },
  { text: 'docs', description: 'Writing docs' },
  { text: 'style', description: 'Improving structure/format of the code' },
  { text: 'refactor', description: 'Refactoring code' }
], {
  headerText: 'Select Commit Types: ',
  perPage: 5,
  footerText: 'Space: toggle, Enter: confirm'
})

console.log(result)
// { selectedIndices: [0, 2, 4], error: null }
```

### inputPrompt

The `inputPrompt` function is a terminal input prompt. It provides CJK character support and standard terminal shortcut keys (such as ctrl+a, ctrl+e), password input echo and other functions.

```js
import { inputPrompt } from '@reliverse/dler-prompt'

const username = inputPrompt("Enter username: ")
// { value: "reliverse", error: null }

const password = inputPrompt("Enter password: ", {
  echoMode: 'password'
})
// { value: "123456", error: null }
```

## License

MIT
