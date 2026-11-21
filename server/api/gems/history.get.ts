import { count, desc, eq } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { z } from 'zod'
import { db } from '#server/database/index'
import { games, gemTransactions } from '#server/database/schema'
import { requireUser } from '#server/utils/auth'
import { parseQuery } from '#server/utils/validate'
import { historyKind } from '#shared/gem-history'
import type { GemHistoryResponse } from '#shared/types/api'

const querySchema = z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
})

export default defineEventHandler(async (event): Promise<GemHistoryResponse> => {
    const u = await requireUser(event)
    const { page, pageSize } = parseQuery(event, querySchema)
    const [rows, [totalRow]] = await Promise.all([
        db.select({ tx: gemTransactions, gameName: games.name })
            .from(gemTransactions)
            .leftJoin(games, eq(games.slug, gemTransactions.category))
            .where(eq(gemTransactions.userId, u.id))
            .orderBy(desc(gemTransactions.createdAt), desc(gemTransactions.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ n: count() }).from(gemTransactions).where(eq(gemTransactions.userId, u.id))
    ])
    return {
        items: rows.map(({ tx, gameName }) => ({
            id: tx.id,
            kind: historyKind(tx),
            gameName: gameName ?? null,
            amount: tx.amount,
            balanceAfter: tx.balanceAfter,
            category: tx.category,
            refund: tx.refund,
            appId: tx.appId,
            meta: tx.meta ?? null,
            createdAt: tx.createdAt.toISOString()
        })),
        page,
        pageSize,
        total: totalRow?.n ?? 0
    }
})
