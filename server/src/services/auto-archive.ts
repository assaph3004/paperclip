import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { executionWorkspaces, issues } from "@paperclipai/db";
import { daysToMs, repr } from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";

const execFileAsync = promisify(execFile);

const AUTO_ARCHIVE_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

const CANCELLED_ARCHIVE_DAYS = 2;
const REVIEW_ISSUE_ARCHIVE_DAYS = 2;
const MERGED_PR_ARCHIVE_DAYS = 3;

const REVIEW_TITLE_PREFIXES = ["Review silent active run", "Review productivity"];

async function isBranchMergedIntoBase(cwd: string, baseRef: string): Promise<boolean | null> {
  try {
    await execFileAsync("git", ["-C", cwd, "fetch", "--quiet"], { cwd });
  } catch {
    // fetch failure is non-fatal; proceed with local state
  }
  try {
    await execFileAsync("git", ["-C", cwd, "merge-base", "--is-ancestor", "HEAD", baseRef], { cwd });
    return true;
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: unknown }).code : null;
    if (code === 1) return false;
    return null; // indeterminate
  }
}

export function createAutoArchiveService(db: Db) {
  async function archiveStaleIssues(): Promise<{ archived: number }> {
    let archived = 0;
    const now = new Date();

    // 1. Cancelled issues older than CANCELLED_ARCHIVE_DAYS
    const cancelledCutoff = new Date(now.getTime() - daysToMs(CANCELLED_ARCHIVE_DAYS));
    const cancelledRows = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          eq(issues.status, "cancelled"),
          isNull(issues.hiddenAt),
          lt(issues.cancelledAt, cancelledCutoff),
          isNotNull(issues.cancelledAt),
        ),
      );

    // 2. Review system issues (by title prefix) that are done/cancelled older than REVIEW_ISSUE_ARCHIVE_DAYS
    const reviewCutoff = new Date(now.getTime() - daysToMs(REVIEW_ISSUE_ARCHIVE_DAYS));
    const reviewRows = await db
      .select({ id: issues.id })
      .from(issues)
      .where(
        and(
          isNull(issues.hiddenAt),
          repr(
            or(...REVIEW_TITLE_PREFIXES.map((prefix) => sql<boolean>`${issues.title} LIKE ${prefix + "%"}`)),
            "auto-archive review title-prefix filter",
          ),
          repr(
            or(eq(issues.status, "done"), eq(issues.status, "cancelled")),
            "auto-archive review status filter",
          ),
          lt(issues.updatedAt, reviewCutoff),
        ),
      );

    // 3. Done issues with linked execution workspace whose branch is merged — archive after MERGED_PR_ARCHIVE_DAYS
    const mergedCutoff = new Date(now.getTime() - daysToMs(MERGED_PR_ARCHIVE_DAYS));
    const workspaceRows = await db
      .select({
        id: issues.id,
        completedAt: issues.completedAt,
        cwd: executionWorkspaces.cwd,
        baseRef: executionWorkspaces.baseRef,
        branchName: executionWorkspaces.branchName,
      })
      .from(issues)
      .innerJoin(executionWorkspaces, eq(issues.executionWorkspaceId, executionWorkspaces.id))
      .where(
        and(
          eq(issues.status, "done"),
          isNull(issues.hiddenAt),
          isNotNull(issues.completedAt),
          lt(issues.completedAt, mergedCutoff),
          isNotNull(executionWorkspaces.cwd),
          isNotNull(executionWorkspaces.baseRef),
          isNotNull(executionWorkspaces.branchName),
        ),
      );

    const mergedIssueIds: string[] = [];
    for (const row of workspaceRows) {
      if (!row.cwd || !row.baseRef) continue;
      try {
        const merged = await isBranchMergedIntoBase(row.cwd, row.baseRef);
        if (merged === true) mergedIssueIds.push(row.id);
      } catch (err) {
        logger.debug({ err, issueId: row.id }, "auto-archive: could not check branch merge status");
      }
    }

    // Collect all unique IDs to archive
    const toArchiveIds = new Set<string>([
      ...cancelledRows.map((row) => row.id),
      ...reviewRows.map((row) => row.id),
      ...mergedIssueIds,
    ]);

    if (toArchiveIds.size === 0) return { archived: 0 };

    const hiddenAt = now;
    for (const id of toArchiveIds) {
      await db
        .update(issues)
        .set({ hiddenAt, updatedAt: now })
        .where(and(eq(issues.id, id), isNull(issues.hiddenAt)));
      archived++;
    }

    if (archived > 0) {
      logger.info({ archived }, "auto-archive: archived stale issues");
    }

    return { archived };
  }

  function start(): () => void {
    // Run once immediately on startup
    void archiveStaleIssues().catch((err) => {
      logger.error({ err }, "auto-archive: startup run failed");
    });

    const timer = setInterval(() => {
      void archiveStaleIssues().catch((err) => {
        logger.error({ err }, "auto-archive: periodic run failed");
      });
    }, AUTO_ARCHIVE_INTERVAL_MS);
    timer.unref?.();

    return () => clearInterval(timer);
  }

  return { archiveStaleIssues, start };
}
