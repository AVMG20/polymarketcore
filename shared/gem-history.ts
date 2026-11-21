import type { GemHistoryKind } from '#shared/types/api'

/** What a gem ledger row is, for labels in the history. */
export function historyKind(row: { category: string, amount: number, refund: boolean, appId: string | null }): GemHistoryKind {
    if (row.category === 'welcome' || row.category === 'daily' || row.category === 'admin') return row.category
    if (row.refund) return 'refund'
    if (row.amount < 0) return 'spend'
    return row.appId ? 'bounty' : 'admin'
}
