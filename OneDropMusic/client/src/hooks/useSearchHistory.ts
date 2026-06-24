import { useState, useCallback, useEffect } from "react";

const API_BASE_URL = "http://localhost:8081";
const MAX_HISTORY  = 10;

/**
 * Search history backed by Spring Boot DB.
 * Works across browsers, Electron windows, and app restarts.
 *
 * Strategy:
 *  - On mount: fetch from backend, hydrate localStorage as cache
 *  - On push:  update localStorage immediately (instant UI), then sync to backend
 *  - On remove/clear: same optimistic-then-sync pattern
 */
export function useSearchHistory(source: "youtube" | "spotify") {
    const cacheKey = `searchHistory_${source}`;

    const loadCache = (): string[] => {
        try {
            const raw = localStorage.getItem(cacheKey);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    };

    const [history, setHistory] = useState<string[]>(loadCache);

    const saveCache = (items: string[]) => {
        try { localStorage.setItem(cacheKey, JSON.stringify(items)); } catch {}
    };

    // Hydrate from backend on mount
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/history/${source}`)
            .then(r => r.ok ? r.json() : null)
            .then((data: string[] | null) => {
                if (data && data.length > 0) {
                    setHistory(data);
                    saveCache(data);
                }
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    const push = useCallback((query: string) => {
        const q = query.trim();
        if (!q) return;
        setHistory(prev => {
            const next = [q, ...prev.filter(h => h.toLowerCase() !== q.toLowerCase())]
                .slice(0, MAX_HISTORY);
            saveCache(next);
            return next;
        });
        fetch(`${API_BASE_URL}/api/history/${source}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q }),
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    const remove = useCallback((query: string) => {
        setHistory(prev => {
            const next = prev.filter(h => h !== query);
            saveCache(next);
            return next;
        });
        fetch(`${API_BASE_URL}/api/history/${source}?query=${encodeURIComponent(query)}`, {
            method: "DELETE",
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    const clear = useCallback(() => {
        setHistory([]);
        try { localStorage.removeItem(cacheKey); } catch {}
        fetch(`${API_BASE_URL}/api/history/${source}/all`, {
            method: "DELETE",
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, cacheKey]);

    return { history, push, remove, clear };
}