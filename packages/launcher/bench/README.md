# CLI Launcher Performance Benchmarks

This directory contains performance benchmarks for the CLI launcher package.

## Running Benchmarks

```bash
# Run the performance benchmark
bun run bench/performance.ts

# Or from the package directory
cd packages/launcher
bun run bench/performance.ts
```

## Benchmark Tests

### 1. Cold Start Performance
- Tests launcher startup with no cached metadata
- Measures discovery time, module loading, and initialization
- Expected: 50-100ms for 3 commands

### 2. Warm Start Performance  
- Tests launcher startup with cached metadata
- Measures cache loading and validation time
- Expected: 10-30ms for 3 commands

### 3. Command Execution Performance
- Tests actual command execution with argument parsing
- Measures handler execution time
- Expected: <5ms per command execution

## Performance Targets

Based on the optimization plan:

- **Cold Start**: 60-75% faster than baseline
- **Warm Start**: 90-95% faster than baseline  
- **Memory Usage**: 90% reduction for single command execution
- **Help Generation**: 40-60% faster

## Test Commands

The benchmark creates 3 test commands with different complexity levels:

1. **test-command**: Complex command with boolean and number arguments
2. **another-command**: Command with required string arguments
3. **third-command**: Simple command with no arguments

## Interpreting Results

The benchmark outputs a table showing:
- Operation name
- Duration in milliseconds
- Memory usage (RSS and Heap Used)
- Number of iterations

Look for:
- Significant improvement between cold and warm start
- Low memory usage per operation
- Consistent performance across iterations
