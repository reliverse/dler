# Magic Spells

## Features

> Please check the [README.md](../../README.md#16-spell) file for more details.

## Details (for contributors)

Step-by-step explanation of how the entire magic spells system works with detailed examples.

## **🔮 Magic Spells System - Complete Flow**

### **Step 1: 🚀 Initialization**

When we call `applyMagicSpells()`:

```typescript
await applyMagicSpells(["dist-jsr", "dist-npm", "dist-libs/sdk"]);
```

The system validates targets and begins processing.

---

### **Step 2: 📁 Source Directory Scanning**

**What happens:**

1. System scans the `src` directory for files containing magic directives
2. Only files with magic directives will be processed later

**Example directory structure:**

```bash
src/
├── libs/
│   └── sdk/
│       ├── utils.ts          // ✅ Contains magic directives
│       ├── config.json       // ❌ No magic directives
│       └── api/
│           └── types.ts      // ✅ Contains magic directives
├── index.ts                  // ✅ Contains magic directives
└── helper.js                 // ❌ No magic directives
```

**Magic directive detection:**

```typescript
// ✅ This will be detected:
// <dler-replace-line-to `console.log("JSR version");` if 'current file path starts with dist-jsr'>
console.log("Default version");

// ✅ This will also be detected:
// @ts-expect-error some-reason <dler-remove-line>
const debugMode = true;
```

**Result:** Files with directives found:

- `src/libs/sdk/utils.ts`
- `src/libs/sdk/api/types.ts`
- `src/index.ts`

---

### **Step 3: 🎯 Distribution File Mapping**

For each source file with directives, the system finds corresponding distribution files.

**Example 1: Library File**:

```typescript
Source: "src/libs/sdk/utils.ts"

Distribution files found:
├── "dist-libs/sdk/npm/bin/utils.js"    // ✅ Exists
├── "dist-libs/sdk/npm/bin/utils.ts"    // ❌ Doesn't exist  
├── "dist-libs/sdk/jsr/bin/utils.js"    // ❌ Doesn't exist
└── "dist-libs/sdk/jsr/bin/utils.ts"    // ✅ Exists

Files to process: 
- dist-libs/sdk/npm/bin/utils.js
- dist-libs/sdk/jsr/bin/utils.ts
```

**Example 2: Regular File**:

```typescript
Source: "src/index.ts"

Distribution files found:
├── "dist-npm/bin/index.js"    // ✅ Exists
├── "dist-npm/bin/index.ts"    // ❌ Doesn't exist
├── "dist-jsr/bin/index.js"    // ❌ Doesn't exist  
└── "dist-jsr/bin/index.ts"    // ✅ Exists

Files to process:
- dist-npm/bin/index.js
- dist-jsr/bin/index.ts
```

---

### **Step 4: 📋 Processing Each Distribution File**

For each distribution file found, the system:

#### **4a: 📂 Copy from Source (if enabled)**

**Source-to-Dist Mapping Examples:**

```typescript
// Library mappings:
"dist-libs/sdk/npm/bin/utils.js"     ← "src/libs/sdk/utils.ts"
"dist-libs/sdk/jsr/bin/utils.ts"     ← "src/libs/sdk/utils.ts"
"dist-libs/utils/npm/bin/helper.js"  ← "src/libs/utils/helper.ts"

// Regular mappings:
"dist-npm/bin/index.js"              ← "src/index.ts"
"dist-jsr/bin/index.ts"              ← "src/index.ts"
"dist-npm/bin/config.json"           ← "src/config.json"
```

#### **4b: 🎭 Process Magic Directives**

**Example file processing:**

**Original source file** (`src/libs/sdk/utils.ts`):

```typescript
export function logMessage(msg: string) {
  // <dler-replace-line-to `console.log("[JSR]", msg);` if 'current file path starts with dist-jsr'>
  console.log("[Default]", msg);
  
  // <dler-replace-line-to `return "npm-build";` if 'current file path starts with dist-npm' else 'return "jsr-build";'>
  return "dev-build";
  
  // <dler-remove-line>
  const debugInfo = "This line will be removed";
}
```

**After copying and processing in `dist-libs/sdk/jsr/bin/utils.ts`:**

```typescript
export function logMessage(msg: string) {
  console.log("[JSR]", msg);  // ✅ Replaced (JSR path condition met)
  
  return "jsr-build";          // ✅ Replaced (else condition used)
  
  // ✅ Line removed (debug line removed)
}
```

**After copying and processing in `dist-libs/sdk/npm/bin/utils.js`:**

```typescript
export function logMessage(msg: string) {
  console.log("[Default]", msg); // ✅ No change (JSR condition not met)
  
  return "npm-build";            // ✅ Replaced (npm condition met)
  
  // ✅ Line removed (debug line removed)
}
```

---

### **Step 5: 🔄 Complete Flow Example**

**Starting setup:**

```bash
Project structure:
src/
├── libs/sdk/utils.ts     // Contains magic directives
└── index.ts              // Contains magic directives

dist-libs/
└── sdk/
    ├── npm/bin/utils.js  // Will be processed
    └── jsr/bin/utils.ts  // Will be processed

dist-npm/bin/index.js     // Will be processed
dist-jsr/bin/index.ts     // Will be processed
```

**Command executed:**

```typescript
await applyMagicSpells(["dist-libs/sdk", "dist-npm", "dist-jsr"]);
```

**Step-by-step execution:**

1. **🔍 Scan `src` directory:**

   ```bash
   [spells] ⇒ scanning src: /project/src
   [spells] ⇒ found directives in src/libs/sdk/utils.ts
   [spells] ⇒ found directives in src/index.ts
   [spells] Found 2 source files with magic directives
   ```

2. **🎯 Process dist-libs/sdk target:**

   ```bash
   [spells] ⇒ processing target: dist-libs/sdk
   [spells] ↳ copied from src/libs/sdk/utils.ts
   [spells] ✓ updated dist-libs/sdk/npm/bin/utils.js
   [spells] ↳ copied from src/libs/sdk/utils.ts  
   [spells] ✓ updated dist-libs/sdk/jsr/bin/utils.ts
   ```

3. **📦 Process dist-npm target:**

   ```bash
   [spells] ⇒ processing target: dist-npm
   [spells] ↳ copied from src/index.ts
   [spells] ✓ updated dist-npm/bin/index.js
   ```

4. **📦 Process dist-jsr target:**

   ```bash
   [spells] ⇒ processing target: dist-jsr
   [spells] ↳ copied from src/index.ts
   [spells] ✓ updated dist-jsr/bin/index.ts
   ```

---

### **Step 6: 📝 Magic Directive Types**

#### **🔄 Replace Line**

```typescript
// Source:
// <dler-replace-line-to `newContent` if 'condition' else 'altContent'>
originalContent

// Result depends on condition evaluation
```

#### **❌ Remove Line**

```typescript
// Source:
// <dler-remove-line>
thisLineWillBeRemoved

// Result: Line is completely removed
```

#### **🗑️ Remove File**

```typescript
// Source:
// <dler-remove-file>

// Result: Entire file is deleted
```

---

### **Step 7: 🎛️ Path Condition Evaluation**

**Condition examples:**

```typescript
// Single path condition:
if 'current file path starts with dist-jsr'

// Multiple path condition:
if 'current file path starts with dist-jsr or dist-npm'

// Library-specific condition:
if 'current file path starts with dist-libs/sdk'
```

**Context during evaluation:**

```typescript
// For file: dist-libs/sdk/jsr/bin/utils.ts
ctx = { filePath: "dist-libs/sdk/jsr/bin/utils.ts" }

// Condition evaluation:
"dist-jsr"           → false ❌
"dist-libs"          → true  ✅
"dist-libs/sdk"      → true  ✅
"dist-libs/sdk/jsr"  → true  ✅
```

---

### **Step 8: 🚀 Performance Features**

#### **📊 Caching:**

- **Spell paths**: Built once and cached
- **Library registries**: Cached per library
- **Available registries**: Cached globally

#### **⚡ Batching:**

```typescript
// Files processed in batches (default: 100 files per batch)
// With concurrency control (default: 4 concurrent operations)
```

#### **🛡️ Error Handling:**

```typescript
// Individual file errors don't stop the entire process
// unless stopOnError: true is set

// Example error handling:
[spells] Failed to copy from source: File not found
[spells] ✓ updated dist-npm/bin/index.js  // Process continues
```

---

Based on the implementation, let me trace through what would happen for a source file `src\libs\sdk\sdk-mod.ts` when processing `dist-npm` and `dist-jsr` targets.
Read file: src/impl/spell/applyMagicSpells.ts
Read file: src/impl/spell/applyMagicSpells.ts
Now I can provide a detailed explanation of what would happen with `src\libs\sdk\sdk-mod.ts` for `dist-npm` and `dist-jsr` targets.

## **📋 Expected Output for `src\libs\sdk\sdk-mod.ts`**

### **🔍 Source File Analysis:**

```bash
Source file: src/libs/sdk/sdk-mod.ts
- Extension: .ts
- Base name: sdk-mod  
- Directory within src: libs/sdk
- Relative path within src: libs/sdk/sdk-mod.ts
```

### **🎯 Distribution File Mapping:**

When processing `dist-npm` and `dist-jsr` targets, the system will look for these files:

#### **📦 For `dist-npm` target:**

```typescript
Base path: "dist-npm/bin"  // From DIST_PATHS["dist-npm"]
Full directory: "dist-npm/bin/libs/sdk"

Files to check (in order):
1. "dist-npm/bin/libs/sdk/sdk-mod.js"  ✅ (Priority for .ts files)
2. "dist-npm/bin/libs/sdk/sdk-mod.ts"  ⚪ (Fallback)

Expected output file: 
- dist-npm/bin/libs/sdk/sdk-mod.js
```

#### **📦 For `dist-jsr` target:**

```typescript
Base path: "dist-jsr/bin"  // From DIST_PATHS["dist-jsr"]  
Full directory: "dist-jsr/bin/libs/sdk"

Files to check (in order):
1. "dist-jsr/bin/libs/sdk/sdk-mod.js"  ⚪ (Priority for .ts files)
2. "dist-jsr/bin/libs/sdk/sdk-mod.ts"  ✅ (Fallback)

Expected output file:
- dist-jsr/bin/libs/sdk/sdk-mod.ts
```

### **📁 Complete Processing Flow:**

#### **Step 1: Source Scanning**

```bash
[spells] ⇒ scanning src: /project/src
[spells] ⇒ found directives in src/libs/sdk/sdk-mod.ts
```

#### **Step 2: Distribution Mapping**

```typescript
// For dist-npm target:
sourceFile: "src/libs/sdk/sdk-mod.ts"
distFiles: ["dist-npm/bin/libs/sdk/sdk-mod.js"]  // If exists

// For dist-jsr target:  
sourceFile: "src/libs/sdk/sdk-mod.ts"
distFiles: ["dist-jsr/bin/libs/sdk/sdk-mod.ts"]  // If exists
```

#### **Step 3: Processing**

```bash
# For dist-npm:
[spells] ⇒ processing target: dist-npm
[spells] ↳ copied from src/libs/sdk/sdk-mod.ts
[spells] ✓ updated dist-npm/bin/libs/sdk/sdk-mod.js

# For dist-jsr:
[spells] ⇒ processing target: dist-jsr  
[spells] ↳ copied from src/libs/sdk/sdk-mod.ts
[spells] ✓ updated dist-jsr/bin/libs/sdk/sdk-mod.ts
```

### **🎭 Magic Directive Processing Example:**

If `src/libs/sdk/sdk-mod.ts` contains:

```typescript
export const buildTarget = "development";
// <dler-replace-line-to `export const buildTarget = "npm";` if 'current file path starts with dist-npm'>

export function getApiUrl() {
  // <dler-replace-line-to `return "https://api.npmjs.org";` if 'current file path starts with dist-npm' else 'return "https://jsr.io/api";'>
  return "http://localhost:3000";
}
```

**Result in `dist-npm/bin/libs/sdk/sdk-mod.js`:**

```typescript
export const buildTarget = "npm";  // ✅ Replaced (npm condition met)

export function getApiUrl() {
  return "https://api.npmjs.org";   // ✅ Replaced (npm condition met)
}
```

**Result in `dist-jsr/bin/libs/sdk/sdk-mod.ts`:**

```typescript
export const buildTarget = "development";  // ⚪ No change (npm condition not met)

export function getApiUrl() {
  return "https://jsr.io/api";             // ✅ Replaced (else condition used)
}
```

### **📂 Final Directory Structure:**

```bash
📁 Project structure after processing:

dist-npm/
└── bin/
    └── libs/
        └── sdk/
            └── sdk-mod.js     ✅ (Processed with npm-specific content)

dist-jsr/  
└── bin/
    └── libs/
        └── sdk/
            └── sdk-mod.ts     ✅ (Processed with jsr-specific content)

src/
└── libs/
    └── sdk/
        └── sdk-mod.ts         📝 (Original source - unchanged)
```

### **🔍 Key Points:**

- ✅ **Latest source code** (copied from `src`)
- ✅ **Processed magic directives** (replaced/removed based on conditions)  
- ✅ **Target-specific content** (different content for npm vs jsr)
- ✅ **Clean distribution files** (no magic directive comments remain)
- ✅ **Directory Structure Preserved**: The `libs/sdk` structure is maintained in dist directories
- ✅ **Extension Handling**: `.ts` source typically becomes `.js` in npm and stays `.ts` in jsr
- ✅ **Path-Specific Processing**: Magic directives apply different transformations based on target
- ✅ **File Existence Check**: Only processes files that actually exist in dist directories

The system ensures each distribution target gets the appropriate version of the code with the correct transformations applied.
