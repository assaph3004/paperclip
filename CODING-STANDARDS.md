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

## Rule 5 — File size: 300 / 500 / 200 lines

Soft caps: 300 for utility files, 500 for service files, 200 for route files. A file growing past its cap is a signal to decompose — extract sub-modules (e.g. `recovery/service.ts` → `service.ts` + `escalation.ts` + `watchdog.ts`), not to bump the cap. If a file genuinely cannot be split (generated code, single-purpose schema), add a one-line module-top docstring linking the `DESIGN-DECISIONS.md` entry that justifies the size.

**Wrong:** `routes/issues.ts` at 4000+ lines mixing read/write/comments/recovery handlers.

**Right:** `routes/issues/read.ts` + `routes/issues/write.ts` + `routes/issues/comments.ts`, each under 500 lines.

## Rule 6 — Boolean flag parameters are opaque at call sites

A bare `boolean` parameter forces every reader to look up which side of the boolean does what. Replace with a named options object or two separate functions.

**Wrong:** `filterInboxIssues(issues, false)` — what does `false` mean here? Hidden? Archived? Already filtered?

**Right:** `filterInboxIssues(issues, { includeArchived: false })` — or split into `filterUnarchivedInboxIssues(issues)` and `filterAllInboxIssues(issues)`.

## Rule 7 — Components that exist only to fire effects are hooks, not components

If a component renders `null` and exists only to run `useQuery` + `useEffect`, that is a hook. Returning `null` from JSX is a code smell that masks state-only logic as UI.

**Wrong:**

```tsx
function ParentIssueFetcher({ issueId, onLoaded }: Props) {
  const { data } = useQuery({ queryKey: ["parent", issueId], queryFn: () => fetchParent(issueId) });
  useEffect(() => { if (data) onLoaded(data); }, [data, onLoaded]);
  return null;
}
```

**Right:**

```ts
export function useParentIssue(issueId: string) {
  return useQuery({ queryKey: ["parent", issueId], queryFn: () => fetchParent(issueId) });
}
```

Callers read `parent` directly from the hook's return value — no side-effect indirection.

## Rule 8 — Extract magic numbers shared across modules

A value repeated in 3+ files is shared infrastructure, not a per-file constant. Move it to a colocated constants module and import from there.

**Wrong:** `refetchInterval: 60_000` hardcoded in `Sidebar.tsx`, `SidebarAgents.tsx`, `Inbox.tsx`, `Issues.tsx`, `CompanySettingsSidebar.tsx`. Tests redefine `THREE_DAYS_MS` locally instead of importing the production constant.

**Right:** `ui/src/lib/poll-intervals.ts` exports `LIVE_RUNS_REFETCH_INTERVAL_MS = 60_000` and `DONE_EXPIRE_MS = daysToMs(3)`; every site imports from there.

## Rule 9 — No dual-mode optional parameters; use a discriminated union or finish the migration

If a function accepts both `mineIssues?: Issue[]` AND `mineIssueCount?: number` as mutually-exclusive alternatives, TypeScript will not catch the case where neither is passed. Either complete the migration (drop the old form) or model the two modes as a discriminated union so the type system enforces it.

**Wrong:**

```ts
function computeInboxBadgeData(opts: { mineIssues?: Issue[]; mineIssueCount?: number; ... }) {
  // both optional — caller can pass neither, compiler is silent
}
```

**Right (discriminated union):**

```ts
type MineInput =
  | { kind: "issues"; mineIssues: Issue[] }
  | { kind: "count"; mineIssueCount: number };

function computeInboxBadgeData(opts: MineInput & { ... }) { /* … */ }
```

Or finish the migration: drop `mineIssues`, require `mineIssueCount`.
