import type { GemHistoryKind, GemRange } from '#shared/types/api'

export const GEM_RANGES: readonly GemRange[] = ['7d', '30d', '90d', 'all']
export const GEM_HISTORY_KINDS: readonly GemHistoryKind[] = ['welcome', 'daily', 'admin', 'spend', 'refund', 'bounty']

/** Days in a fixed range (today included), null for all time. */
export function rangeDays(range: GemRange): number | null {
    return range === 'all' ? null : Number(range.slice(0, -1))
}

/** An all-time range longer than this is bucketed by week. */
export const GEM_STATS_MAX_DAYS = 120

/** What a gem ledger row is, for labels in the history. */
export function historyKind(row: { category: string, amount: number, refund: boolean, appId: string | null }): GemHistoryKind {
    if (row.category === 'welcome' || row.category === 'daily' || row.category === 'admin') return row.category
    if (row.refund) return 'refund'
    if (row.amount < 0) return 'spend'
    return row.appId ? 'bounty' : 'admin'
}
