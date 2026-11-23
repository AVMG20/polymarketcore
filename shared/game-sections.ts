import type { GameSummary } from '#shared/types/api'

export type GameSectionKey = 'games' | 'new' | 'other-new' | 'drafts' | 'other-drafts'

export interface GameSection {
    key: GameSectionKey
    title: string
    note: string
    /** True when the section only contains other makers' unpublished games (visible to admins). */
    adminOnly: boolean
    games: GameSummary[]
}

/**
 * Split the games returned by `/api/games` into display sections, keeping the
 * incoming order within each. Drafts and unverified games owned by someone else
 * only arrive for admins, so they get their own clearly marked sections instead
 * of being lumped under "Your drafts" or "New".
 */
export function groupGameSections(games: readonly GameSummary[], viewerId: string | null): GameSection[] {
    const isOwn = (g: GameSummary) => viewerId !== null && g.app.owner?.id === viewerId
    const verified: GameSummary[] = []
    const myUnverified: GameSummary[] = []
    const otherUnverified: GameSummary[] = []
    const myDrafts: GameSummary[] = []
    const otherDrafts: GameSummary[] = []

    for (const g of games) {
        if (g.visibility === 'draft') {
            if (isOwn(g)) myDrafts.push(g)
            else otherDrafts.push(g)
        } else if (g.app.verified) {
            verified.push(g)
        } else if (isOwn(g)) {
            myUnverified.push(g)
        } else {
            otherUnverified.push(g)
        }
    }

    return ([
        { key: 'games', title: 'Games', note: '', adminOnly: false, games: verified },
        { key: 'new', title: 'New', note: "Only you and admins · stars don't count yet", adminOnly: false, games: myUnverified },
        { key: 'other-new', title: 'Unverified', note: "Only the maker and admins · stars don't count yet", adminOnly: true, games: otherUnverified },
        { key: 'drafts', title: 'Your drafts', note: 'Only you and admins', adminOnly: false, games: myDrafts },
        { key: 'other-drafts', title: 'Other drafts', note: 'Only the maker and admins', adminOnly: true, games: otherDrafts }
    ] satisfies GameSection[]).filter(s => s.games.length > 0)
}
