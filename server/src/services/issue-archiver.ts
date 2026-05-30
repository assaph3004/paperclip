import { and, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { issues } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";

export function createIssueArchiver(db: Db) {
  return {
    async archiveStaleIssues(thresholdDays: number): Promise<number> {
      const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
      const updated = await db
        .update(issues)
        .set({ hiddenAt: sql`now()` })
        .where(
          and(
            isNull(issues.hiddenAt),
            or(
              and(sql`${issues.status} = 'done'`, lt(issues.completedAt, cutoff)),
              and(sql`${issues.status} = 'cancelled'`, lt(issues.cancelledAt, cutoff)),
            )!,
          ),
        )
        .returning({ id: issues.id });
      const count = updated.length;
      logger.info({ count, thresholdDays }, "Auto-archived stale issues");
      return count;
    },
  };
}
