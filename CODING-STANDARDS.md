# Coding standards

Board-validated rules from PR review (ALL-3797). Apply to all new and touched code.

## Rule 1 — Non-null assertions: use `repr()`, not `!`

Do not use the TypeScript non-null assertion (`x!`, `x!.y`) in new code. If a value must be non-null, prove it: either narrow with an explicit `if (!x) throw new Error(...)` or call the shared `repr()` helper. Non-null assertions silently swallow the case where the value IS null at runtime; `repr()` throws with a useful label so we see the failure in logs.

**Wrong:**

```ts
const condition = or(eq(issues.status, "done"), eq(issues.status, "cancelled"))!;
```

**Right:**

```ts
import { repr } from "@paperclipai/shared";
const condition = repr(
  or(eq(issues.status, "done"), eq(issues.status, "cancelled")),
  "auto-archive status filter",
);
```

## Rule 2 — Name by domain content, not shape

Variable, parameter, and method names must describe the domain concept they hold, not the shape. Avoid single-word generics: `app`, `slug`, `service`, `data`, `result`, `row`, `count`, `updated`. Names must stay consistent across layers (API param ↔ service filter ↔ DB column).

**Wrong:** `count`, `runOnce`, `showArchived` (UI) vs `includeArchived` (API) for the same concept.

**Right:** `archivedIssueCount`, `archiveStaleIssues`, `includeArchived` everywhere (API ↔ service ↔ UI prop).

## Rule 3 — Two occurrences = extract; three = question the design

If you write the same constant, expression, or pattern twice in related context, extract it. If you find yourself writing it a third time, treat that as a design smell and reshape (config object, named filter helper, builder function) rather than copying.

Specific applications:

- Day/ms conversions → use `daysToMs(n)` from `@paperclipai/shared`. Never write `X * 24 * 60 * 60 * 1000` inline.
- Repeated Drizzle conditions (e.g. `isNull(issues.hiddenAt)`) → extract a named filter helper colocated with the table.
- Repeated string construction (e.g. fingerprint templates) → extract a single builder function.

## Rule 4 — Services with ≥3 methods use a class, not a factory returning a plain object

Pattern to avoid: `createXyzService(db, deps) { return { foo, bar, baz } }`. Replace with `class XyzService { constructor(db, deps) {} foo() {} bar() {} baz() {} }`. TypeScript infers an interface contract from the class, the type is named in error messages, and state lives on `this` instead of closure.

Single-method operations stay as plain exported functions — this rule only applies once a "service" has 3+ public methods or holds state.

**Wrong:**

```ts
export function createIssueArchiver(db: Db) {
  return {
    async archiveStaleIssues() { /* … */ },
  };
}
```

(One method — fine as a plain function: `export async function archiveStaleIssues(db: Db) { … }`.)

**Right (3+ methods):**

```ts
export class RecoveryService {
  constructor(private db: Db, private deps: RecoveryDeps) {}
  async runRecoveryPass() { /* … */ }
  async classifySignal(/* … */) { /* … */ }
  async resolveStaleRun(/* … */) { /* … */ }
}
```
