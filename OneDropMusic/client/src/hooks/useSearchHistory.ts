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
   // useSearchHistory.ts — replace the useEffect with this:

useEffect(() => {
    const cached = loadCache();

    // If we already have local data, use it — don't overwrite with backend response.
    // This prevents the race condition where a slow backend response wipes
    // a freshly-pushed entry from the local state.
    if (cached.length > 0) {
        setHistory(cached);
        return;
    }

    // Only hit the backend when localStorage is truly empty
    // (new browser, new Electron window, cleared storage).
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
    if (!q) return; // Sécurité : si la requête est vide, on stoppe tout immédiatement !
    
    setHistory(prev => {
        // Sécurité supplémentaire : si prev n'est pas un tableau, on repart sur un tableau vide
        const currentHistory = Array.isArray(prev) ? prev : [];
        
        const next = [q, ...currentHistory.filter(h => h.toLowerCase() !== q.toLowerCase())]
            .slice(0, MAX_HISTORY);
        saveCache(next);
        return next;
    });

    fetch(`${API_BASE_URL}/api/history/${source}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
    }).catch(() => {});
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