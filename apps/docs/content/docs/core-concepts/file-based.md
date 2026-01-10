---
title: "File-Based"
description: "File-Based"
---

**Both sibling and nested structures are fully supported with the rempts' multi-level file-based subcommand logic!**

Let's break down what is possible and how the CLI will resolve each case:

## 1. Structure: Sibling subcommands

```bash
app/
  foo/
    cmd.ts
    bar/
      cmd.ts
    baz/
      cmd.ts
```

**Supported invocations:**

- `my-cli foo`  
  → Loads `app/foo/cmd.ts`
- `my-cli foo bar`  
  → Loads `app/foo/bar/cmd.ts`
- `my-cli foo baz`  
  → Loads `app/foo/baz/cmd.ts`

**How it works:**  
The loader checks for a subfolder matching the next argument. If it exists, it recurses into it. If not, it loads `cmd.ts` in the current directory.

## 2. Structure: Nested subcommands

```bash
app/
  foo/
    cmd.ts
    bar/
      baz/
        cmd.ts
```

**Supported invocations:**

- `my-cli foo`  
  → Loads `app/foo/cmd.ts`
- `my-cli foo bar baz`  
  → Loads `app/foo/bar/baz/cmd.ts`

**How it works:**  

- For `foo bar baz`, it goes:  
  `app/foo` → `app/foo/bar` → `app/foo/bar/baz` → loads `cmd.ts` in the deepest directory.

## 3. Structure: Only nested, no sibling

```bash
app/
  foo/
    bar/
      baz/
        cmd.ts
```

**Supported invocations:**

- `my-cli foo bar baz`  
  → Loads `app/foo/bar/baz/cmd.ts`

## 4. Structure: Only top-level

```bash
app/
  foo/
    cmd.ts
```

**Supported invocations:**

- `my-cli foo`  
  → Loads `app/foo/cmd.ts`

## Summary

- You can have both `cmd.ts` in a directory and subfolders with their own `cmd.ts`.
- The loader always prefers to recurse into a subfolder if the next argument matches a directory.
- If no matching subfolder is found, it loads `cmd.ts` in the current directory.
- This allows for both sibling and nested subcommands, and for a directory to act as both a command and a parent for further subcommands.

**You can mix and match these patterns freely!**
