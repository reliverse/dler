import { prompt as promptFn, confirm, select, password } from './prompt'
import type { PromptOptions, MultiSelectOptions } from './types'
import { createSpinner } from './spinner'
import type { RemptsUtils } from './types'

// Export all types
export * from './types'

// Create the main utilities object
export const utils: RemptsUtils = {
  prompt: Object.assign(promptFn, {
    confirm,
    select,
    password,
    text: (message: string, options?: PromptOptions) => promptFn<string>(message, options),
    multiselect: async <T = string>(message: string, options: MultiSelectOptions<T>): Promise<T[]> => {
      // Fallback: use select repeatedly when a real multiselect UI isn't available
      const { options: choices } = options
      const selected: T[] = []
      console.log(message)
      for (const choice of choices) {
        const ok = await confirm(`Select ${choice.label}?`, { default: false })
        if (ok) selected.push(choice.value as T)
      }
      return selected
    }
  }),
  spinner: createSpinner
}

// Export individual utilities for convenience
export { createSpinner as spinner } from './spinner'

// Export prompt with attached methods
export const prompt = Object.assign(promptFn, {
  confirm,
  select,
  password,
  text: (message: string, options?: PromptOptions) => promptFn<string>(message, options),
  multiselect: async <T = string>(message: string, options: MultiSelectOptions<T>): Promise<T[]> => {
    const { options: choices } = options
    const selected: T[] = []
    console.log(message)
    for (const choice of choices) {
      const ok = await confirm(`Select ${choice.label}?`, { default: false })
      if (ok) selected.push(choice.value as T)
    }
    return selected
  }
}) as RemptsUtils['prompt']

// Also export individual prompt methods
export { confirm, select, password } from './prompt'

// Export validation utilities
export { validate, validateFields } from './validation'
export { SchemaError, getDotPath } from '@standard-schema/utils'