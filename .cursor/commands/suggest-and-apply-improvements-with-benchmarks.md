# Suggest and apply improvements with benchmarks

## Purpose
This command guides the AI to improve a package library's performance using a systematic benchmarking approach. The goal is to ensure optimizations are measurable and don't introduce regressions.

## Packages to Optimize

The following packages should be optimized in priority order (packages with older `lastImproved` timestamps should be prioritized):

| # | Package | Last Improved | Status | Notes |
|---|---------|---------------|--------|-------|
| 0 | `@reliverse/dler` | - | - | CLI package |
| 1 | `@reliverse/build` | - | - | - |
| 2 | `@reliverse/bump` | - | - | - |
| 3 | `@reliverse/config` | - | - | - |
| 4 | `@reliverse/helpers` | - | - | - |
| 5 | `@reliverse/mapkit` | - | - | - |
| 6 | `@reliverse/matcha` | - | - | - |
| 7 | `@reliverse/pathkit` | - | - | - |
| 8 | `@reliverse/publish` | - | - | - |
| 9 | `@reliverse/relico` | - | - | - |
| 10 | `@reliverse/relifso` | - | - | - |
| 11 | `@reliverse/relinka` | - | - | - |
| 12 | `@reliverse/rempts` | - | - | - |
| 13 | `@reliverse/tsconfig` | - | - | - |
| 14 | `@reliverse/typerso` | - | - | - |

**Metadata Fields:**
- **Last Improved**: Timestamp (CET timezone) when performance improvements were last completed (format: `YYYY-MM-DD HH:mm:ss`)
- **Status**: Current optimization status (`pending`, `in-progress`, `completed`, `skipped`)
- **Notes**: Any relevant information about the package or optimization results

**Package Selection Priority:**
- AI should prioritize packages with the oldest `lastImproved` timestamp (or `-` if never improved)
- If multiple packages have the same timestamp, proceed in numerical order
- After completing improvements, update the `lastImproved` timestamp using the PowerShell command below

## Workflow

### Phase 1: Benchmark Setup (if not already completed)

1. **Create benchmark structure:**
   - Create `bench/` directory in the package root
   - Create `bench/perf.ts` as the main benchmark runner
   - Create `bench/impl/` directory for individual benchmark modules
   - Each `impl/*.ts` file should export a function that takes a `benchmark` helper and returns `Promise<BenchmarkResult[]>`

2. **Implement benchmark runner (`bench/perf.ts`):**
   - Use `node:perf_hooks` for accurate timing
   - Include warmup runs (typically 5 iterations) before actual benchmarks
   - Collect detailed statistics: avg, min, max, median, p95, p99, ops/sec
   - Suppress output during benchmarks to avoid interference
   - Write results to a baseline file (e.g., `baseline.txt` in package root)
   - Export `benchmark` helper function and `BenchmarkResult` type

3. **Create benchmark implementations (`bench/impl/*.ts`):**
   - Each file should test specific aspects of the library
   - Cover critical paths, hot functions, and common use cases
   - Include both sync and async operations if applicable
   - Test edge cases and typical workloads
   - Use realistic data and scenarios

4. **Add benchmark script:**
   - Add `"perf": "bun bench/perf.ts"` to the package's `package.json` scripts section

### Phase 2: Establish Baseline

1. **Run initial benchmarks:**
   - Navigate to the package directory: `cd <absolute-path-to-package>`
   - Run `bun perf` to establish baseline performance
   - Save the baseline results for comparison
   - Document the baseline metrics (avg time, ops/sec, percentiles)

### Phase 3: Analyze and Optimize

1. **Select package to optimize:**
   - Review the "Packages to Optimize" table above
   - Select the package with the oldest `lastImproved` timestamp (or `-` if never improved)
   - If multiple packages have the same timestamp, use numerical order
   - **Clear the package's `Notes` field** (set to `-`) to start fresh
   - Update the package's `status` to `in-progress` in the table

2. **Identify optimization opportunities:**
   - Review the library code for performance bottlenecks
   - Look for: unnecessary allocations, inefficient algorithms, redundant computations
   - Consider: memoization, lazy evaluation, batch operations, caching strategies
   - Focus on hot paths identified by benchmarks

3. **Implement optimizations:**
   - Make targeted improvements to the library code
   - Ensure changes maintain API compatibility
   - Follow project coding standards and type safety requirements
   - Add comments explaining optimization rationale

4. **Verify optimizations:**
   - Run `bun perf` again after changes
   - Compare new results with baseline
   - Calculate improvement percentages for key metrics

### Phase 4: Validate and Iterate

1. **Check for regressions:**
   - If any benchmark shows >5% performance regression, investigate and fix
   - If regression is >10%, **immediately revert the specific optimization** that caused it
   - Use git to identify which files were changed and revert only the problematic optimization
   - Ensure no benchmark shows significant degradation (>10%)
   - Verify that improvements are meaningful (>5% improvement in target areas)

2. **Handle severe regressions:**
   - If a regression >10% is detected, **revert the optimization** that caused it
   - Identify the specific code changes that led to the regression
   - Restore the previous version of the affected code
   - Re-run benchmarks to confirm the regression is resolved
   - Document what optimization was attempted and why it failed

3. **Iterate if needed:**
   - If regressions found, revert or refine changes
   - Re-run benchmarks after each iteration
   - Continue until all benchmarks show improvement or neutral performance
   - If an optimization cannot be improved without regression, skip it and document why

4. **Document improvements:**
   - Summarize performance gains achieved
   - Note which optimizations were most effective
   - Update baseline if improvements are significant
   - **Update package metadata in this document:**
     - Set `lastImproved` timestamp using PowerShell: `[System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date).ToUniversalTime(), "Central European Standard Time").ToString("yyyy-MM-dd HH:mm:ss")`
     - Set `status` to `completed`
     - Add any relevant notes about improvements or issues encountered

## Best Practices

- **Benchmark realistic scenarios:** Test actual usage patterns, not just micro-benchmarks
- **Multiple iterations:** Use sufficient iterations (typically 1000+) for statistical significance
- **Warmup runs:** Always include warmup to account for JIT compilation
- **Consistent environment:** Run benchmarks in similar conditions for fair comparison
- **Focus on meaningful improvements:** Don't optimize prematurely; focus on actual bottlenecks
- **Maintain code quality:** Optimizations should not compromise readability or maintainability

## Example Benchmark Structure

```text
package/
├── bench/
│   ├── perf.ts          # Main benchmark runner
│   └── impl/
│       ├── async-ops.ts # Async operation benchmarks
│       ├── sync-ops.ts  # Synchronous operation benchmarks
│       └── edge-cases.ts # Edge case performance
└── baseline.txt         # Baseline results (generated)
```

## Success Criteria

- All benchmarks pass without errors
- No significant regressions (>5% degradation) in any benchmark
- At least one meaningful improvement (>5% gain) in target areas
- Code maintains type safety and follows project standards
- Baseline is updated if improvements are substantial
- Package metadata in this document is updated with completion timestamp

## Updating Package Metadata

After completing optimizations for a package, update the metadata in the "Packages to Optimize" section:

1. **Get the current timestamp in CET:**
   ```powershell
   [System.TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date).ToUniversalTime(), "Central European Standard Time").ToString("yyyy-MM-dd HH:mm:ss")
   ```

2. **Update the package row:**
   - Set `lastImproved` to the timestamp from step 1
   - Set `status` to `completed`
   - Add any relevant notes about the optimization results

3. **Example update:**
   ```text
   | 0 | `@reliverse/dler` | 2024-01-15 14:30:00 | completed | Improved async operations by 12% |
   ```

## Regression Handling

If a benchmark shows regression >10%:
1. **Immediately identify the optimization** that caused the regression
2. **Revert the specific code changes** using git or by restoring the previous version
3. **Re-run benchmarks** to confirm the regression is resolved
4. **Document the failed optimization** in the package's `Notes` column
5. **Continue with other optimizations** or move to the next package
