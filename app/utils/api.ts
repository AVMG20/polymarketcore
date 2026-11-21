/**
 * `$fetch` that forwards the request's cookies during SSR (plain `$fetch`
 * doesn't, so session endpoints would 401). Pass the response type from
 * `#shared/types/api`.
 */
export function apiFetch<T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> {
    let fetcher: typeof $fetch = $fetch
    try {
        fetcher = useRequestFetch() as typeof $fetch
    } catch {
        // outside a Nuxt context: the global $fetch is right
    }
    return fetcher<T>(url, opts as never) as Promise<T>
}

/** HTTP status of a failed `apiFetch`, or undefined. */
export function apiErrorStatus(e: unknown): number | undefined {
    const err = e as { statusCode?: number, status?: number, response?: { status?: number } }
    return err?.statusCode ?? err?.status ?? err?.response?.status
}

/** A readable message for a failed `apiFetch` or better-auth call. */
export function apiErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
    const err = e as {
        data?: { statusMessage?: string, message?: string }
        statusMessage?: string
        message?: string
        error?: { message?: string }
    }
    return err?.data?.statusMessage
        || err?.data?.message
        || err?.error?.message
        || err?.statusMessage
        || fallback
}
