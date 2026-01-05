# Improve code quality (clarity, DRY, modularity)

## Purpose
This command guides the AI to improve a package library's code quality using a systematic refactoring approach. The goal is to enhance code clarity, reduce duplication (DRY), improve modularity, and maintainability while ensuring functionality remains intact.

## Packages to Improve

The following packages should be improved in priority order (packages with older `lastImproved` timestamps should be prioritized):

| # | Package | Last Improved | Status | Notes |
|---|---------|---------------|--------|-------|
| 0 | `@reliverse/dler` | - | - | - |
| 1 | `@reliverse/build` | - | - | - |
| 2 | `@reliverse/bump` | - | - | - |
| 3 | `@reliverse/config` | - | - | - |
| 4 | `@reliverse/datetime` | - | - | - |
| 5 | `@reliverse/helpers` | - | - | - |
| 6 | `@reliverse/mapkit` | - | - | - |
| 7 | `@reliverse/matcha` | - | - | - |
| 8 | `@reliverse/pathkit` | - | - | - |
| 9 | `@reliverse/publish` | - | - | - |
| 10 | `@reliverse/relico` | - | - | - |
| 11 | `@reliverse/relifso` | - | - | - |
| 12 | `@reliverse/relinka` | - | - | - |
| 13 | `@reliverse/rempts` | - | - | - |
| 14 | `@reliverse/tsconfig` | - | - | - |
| 15 | `@reliverse/typerso` | - | - | - |

**Metadata Fields:**
- **Last Improved**: Timestamp (CET timezone) when code quality improvements were last completed (format: `YYYY-MM-DD HH:mm:ss`)
- **Status**: Current improvement status (`pending`, `in-progress`, `completed`, `skipped`)
  - **`in-progress`**: ⚠️ **CRITICAL**: If a package has status `in-progress`, it means another AI agent is currently working on it. **DO NOT** select or work on packages with this status. Skip them and move to the next available package.
- **Notes**: Any relevant information about the package or improvement results

**Package Selection Priority:**
- ⚠️ **IMPORTANT**: **NEVER** select packages with status `in-progress` - another AI agent is currently working on them
- AI should prioritize packages with the oldest `lastImproved` timestamp (or `-` if never improved)
- Only consider packages with status `pending`, `completed` (for re-improvement), or `-` (never improved)
- If multiple packages have the same timestamp, proceed in numerical order
- After completing improvements, update the `lastImproved` timestamp using the bash command below

## Workflow

### Phase 1: Code Analysis Setup

1. **Review package structure:**
   - Examine the package's directory structure and file organization
   - Identify main entry points and module boundaries
   - Review `package.json` to understand dependencies and exports
   - Check `tsconfig.json` for type configuration

2. **Run static analysis:**
   - Run `bun check` to identify any existing linting or type errors
   - Review code complexity metrics (if available)
   - Identify large files or functions that may need refactoring
   - Look for patterns of duplication

3. **Document current state:**
   - Note any obvious code quality issues
   - Identify areas with high complexity
   - List potential refactoring opportunities
   - Document any architectural concerns

### Phase 2: Identify Improvement Opportunities

1. **Select package to improve:**
   - Review the "Packages to Improve" table above
   - ⚠️ **CRITICAL CHECK**: **SKIP any package with status `in-progress`** - this indicates another AI agent is currently working on it. Do not proceed with packages in this state.
   - Select the package with the oldest `lastImproved` timestamp (or `-` if never improved) that has status `pending`, `completed`, or `-`
   - If multiple packages have the same timestamp, use numerical order
   - **Clear the package's `Notes` field** (set to `-`) to start fresh
   - Update the package's `status` to `in-progress` in the table to indicate you are now working on it

2. **Analyze code for quality issues:**

   **Clarity:**
   - Look for unclear variable/function names
   - Identify complex logic that could be simplified
   - Find functions that do too many things (violate Single Responsibility Principle)
   - Look for magic numbers or strings that should be constants
   - Identify unclear comments or missing documentation
   - Find deeply nested conditionals or loops

   **DRY (Don't Repeat Yourself):**
   - Identify duplicated code blocks
   - Find repeated patterns that could be extracted into functions
   - Look for similar logic in multiple places
   - Identify repeated type definitions or interfaces
   - Find duplicate error handling patterns
   - Look for repeated configuration or setup code

   **Modularity:**
   - Identify files that are too large or do too much
   - Find functions that should be split into smaller functions
   - Look for tight coupling between modules
   - Identify code that could be extracted into separate modules
   - Find circular dependencies
   - Look for missing separation of concerns

   **Other Quality Aspects:**
   - Type safety: ensure proper TypeScript usage, avoid `any`
   - Error handling: consistent error handling patterns
   - Testing: ensure code is testable (if tests exist)
   - Consistency: follow project coding standards
   - Accessibility: ensure code follows project accessibility rules

3. **Prioritize improvements:**
   - Focus on high-impact, low-risk improvements first
   - Address code duplication that affects multiple areas
   - Improve clarity in critical paths
   - Break down large, complex functions
   - Extract reusable utilities and helpers

### Phase 3: Implement Improvements

1. **Refactor systematically:**
   - Make one improvement at a time to track changes
   - Ensure changes maintain API compatibility
   - Follow project coding standards and type safety requirements
   - Add or update comments to explain complex logic
   - Use meaningful names for variables, functions, and types
   - Extract constants for magic values

2. **Apply DRY principles:**
   - Extract duplicated code into reusable functions
   - Create shared utilities for common patterns
   - Consolidate similar type definitions
   - Unify error handling approaches
   - Create helper functions for repeated operations

3. **Improve modularity:**
   - Split large files into smaller, focused modules
   - Extract related functionality into separate files
   - Create clear module boundaries with explicit exports
   - Reduce coupling between modules
   - Ensure each module has a single, clear responsibility

4. **Enhance clarity:**
   - Rename unclear identifiers to be more descriptive
   - Simplify complex conditional logic
   - Break down large functions into smaller, well-named functions
   - Add JSDoc comments for public APIs
   - Use early returns to reduce nesting
   - Replace magic numbers/strings with named constants

### Phase 4: Validate and Verify

1. **Verify functionality:**
   - Run `bun check` to ensure no type or linting errors
   - If tests exist, run them to verify functionality is preserved
   - Manually verify that the API surface remains unchanged
   - Check that imports/exports are correct

2. **Check code quality:**
   - Ensure all changes follow project coding standards
   - Verify type safety is maintained or improved
   - Confirm that code is more readable than before
   - Check that duplication has been reduced
   - Verify modularity has improved

3. **Review changes:**
   - Ensure improvements are meaningful and not just cosmetic
   - Verify that refactoring doesn't introduce new complexity
   - Check that the code is easier to understand and maintain
   - Confirm that the changes align with project architecture

4. **Handle issues:**
   - If functionality is broken, revert the problematic change
   - If type errors are introduced, fix them
   - If linting errors appear, address them
   - If the refactoring makes code less clear, reconsider the approach

### Phase 5: Document and Complete

1. **Document improvements:**
   - Summarize the improvements made
   - Note which refactorings were most impactful
   - Document any architectural changes
   - List any patterns or utilities that were extracted

2. **Update package metadata:**
   - **Update package metadata in this document:**
     - Set `lastImproved` timestamp using bash: `dler datetime --now --convert 'Europe/Berlin' --format 'YYYY-MM-DD HH:mm:ss'`
     - Set `status` to `completed`
     - Add any relevant notes about improvements or issues encountered

## Code Quality Improvement Checklist

### Clarity Improvements
- [ ] Variable and function names are descriptive and follow naming conventions
- [ ] Complex logic is broken down into smaller, understandable pieces
- [ ] Functions have a single, clear responsibility
- [ ] Magic numbers/strings are replaced with named constants
- [ ] Comments explain "why" not "what"
- [ ] Code structure is logical and easy to follow
- [ ] Nesting is minimized (early returns, guard clauses)

### DRY Improvements
- [ ] Duplicated code blocks are extracted into reusable functions
- [ ] Similar patterns are unified into shared utilities
- [ ] Type definitions are not duplicated
- [ ] Error handling follows consistent patterns
- [ ] Configuration and setup code is not repeated
- [ ] Common operations are abstracted into helpers

### Modularity Improvements
- [ ] Files are focused and not overly large
- [ ] Functions are appropriately sized and focused
- [ ] Modules have clear boundaries and responsibilities
- [ ] Related functionality is grouped together
- [ ] Circular dependencies are eliminated
- [ ] Separation of concerns is maintained
- [ ] Exports are explicit and minimal

### Type Safety
- [ ] No use of `any` type (unless absolutely necessary)
- [ ] Types are properly defined and used
- [ ] Type inference is leveraged where appropriate
- [ ] Interfaces are used over type aliases (per project preference)
- [ ] Generic types are used appropriately

### Consistency
- [ ] Code follows project coding standards
- [ ] Patterns are consistent across the codebase
- [ ] Error handling is uniform
- [ ] Naming conventions are followed
- [ ] Code style matches the rest of the project

## Best Practices

- **Incremental changes:** Make small, focused improvements rather than large rewrites
- **Preserve functionality:** Always verify that refactoring doesn't break existing behavior
- **Maintain API compatibility:** Don't change public APIs unless necessary
- **Test as you go:** Verify changes don't introduce errors
- **Focus on impact:** Prioritize improvements that have the most benefit
- **Document complex logic:** Add comments where the "why" isn't obvious
- **Follow project standards:** Adhere to existing patterns and conventions
- **Type safety first:** Maintain or improve type safety with every change

## Success Criteria

- All code passes `bun check` (no type or linting errors)
- Code is more readable and maintainable
- Duplication has been reduced
- Modularity has improved
- Functionality is preserved (tests pass if they exist)
- API compatibility is maintained
- Code follows project standards
- Package metadata in this document is updated with completion timestamp

## Updating Package Metadata

After completing improvements for a package, update the metadata in the "Packages to Improve" section:

1. **Get the current timestamp in CET:**
   ```bash
   dler datetime --now --convert 'Europe/Berlin' --format 'YYYY-MM-DD HH:mm:ss'
   ```

2. **Update the package row:**
   - Set `lastImproved` to the timestamp from step 1
   - Set `status` to `completed`
   - Add any relevant notes about the improvement results

3. **Example update:**
   ```text
   | 0 | `@reliverse/dler` | 2024-01-15 14:30:00 | completed | Extracted common utilities, improved function naming, reduced duplication by 40% |
   ```

## Getting Current Timestamp

To get the current timestamp in CET timezone for updating package metadata:

```bash
dler datetime --now --convert 'Europe/Berlin' --format 'YYYY-MM-DD HH:mm:ss'
```

This will output the current date and time in Central European Time (CET/CEST) format suitable for the `lastImproved` field.

## Handling Issues

If improvements introduce problems:

1. **Functionality broken:**
   - Identify the specific change that caused the issue
   - Revert the problematic refactoring
   - Verify functionality is restored
   - Document what was attempted and why it failed

2. **Type errors introduced:**
   - Fix type errors immediately
   - Ensure type safety is maintained
   - If types need to be more complex, document why

3. **Linting errors:**
   - Address all linting errors
   - Follow project linting rules
   - Ensure code quality standards are met

4. **Code becomes less clear:**
   - Reconsider the refactoring approach
   - Sometimes the original code was clearer
   - Don't over-engineer simple solutions
