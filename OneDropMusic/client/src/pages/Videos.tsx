import { useState, useEffect, useCallback } from "react";
import VideoCard from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";
import AlertModal from "@/components/AlertModal";

const API_BASE_URL = "http://localhost:8081";

const LS_SEARCH_QUERY_KEY   = 'videoSearchQuery_page';
const LS_VIDEOS_KEY         = 'videoResults_page';
const LS_TASK_STATUSES_KEY  = 'videoTaskStatuses_page';

export type TaskStatus = 'PENDING' | 'DOWNLOADING' | 'SEPARATING' | 'FAILED' | 'COMPLETED' | 'UNKNOWN' | undefined;

interface YoutubeApiResponse {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnailUrl: string;
    publishedAt: string;
    duration: string;
}

interface Video {
    id: string;
    title: string;
    thumbnail: string;
    duration: string;
    channel: string;
    uploadedAt: string;
}

function useLocalStorageState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
    const loadInitialState = (): T => {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue) return JSON.parse(storedValue) as T;
        } catch (error) {
            console.error(`Error loading state from localStorage for key ${key}:`, error);
            localStorage.removeItem(key);
        }
        return defaultValue;
    };

    const [state, setState] = useState<T>(loadInitialState);

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error saving state to localStorage for key ${key}:`, error);
        }
    }, [key, state]);

    return [state, setState];
}

function formatDuration(isoDuration: string | null | undefined): string {
    if (!isoDuration || typeof isoDuration !== 'string') return 'N/A';
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = isoDuration.match(regex);
    if (!matches) return 'N/A';
    const hours   = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);
    const parts: string[] = [];
    if (hours > 0) { parts.push(hours.toString()); parts.push(minutes.toString().padStart(2, '0')); }
    else           { parts.push(minutes.toString()); }
    parts.push(seconds.toString().padStart(2, '0'));
    return parts.join(':');
}

export default function Videos() {
    const [searchQuery,   setSearchQuery]   = useLocalStorageState<string>(LS_SEARCH_QUERY_KEY, "");
    const [videos,        setVideos]        = useLocalStorageState<Video[]>(LS_VIDEOS_KEY, []);
    const [taskStatuses,  setTaskStatuses]  = useLocalStorageState<Record<string, TaskStatus>>(LS_TASK_STATUSES_KEY, {});

    const [isLoading,     setIsLoading]     = useState(false);
    const [error,         setError]         = useState<string | null>(null);
    const [alertMessage,  setAlertMessage]  = useState<string | null>(null); // for 409 / backend messages

    // ─────────────────────────────────────────────────────────────────────────
    // FIX 1: On mount, clean up stale entries so localStorage never grows unbounded
    //
    //  - COMPLETED / FAILED  → remove entirely (library page has the real status)
    //  - PENDING / DOWNLOADING / SEPARATING → remove too: if the app was closed
    //    mid-processing the backend has no memory of these tasks after restart,
    //    so they would poll forever and never resolve.
    // ─────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        setTaskStatuses(prev => {
            const cleaned: Record<string, TaskStatus> = {};
            Object.entries(prev).forEach(([videoId, status]) => {
                // Keep ONLY tasks that are actively in-progress right now.
                // Everything else is either done (library shows it) or stale.
                if (status === 'PENDING' || status === 'DOWNLOADING' || status === 'SEPARATING') {
                    // These survive only if the backend still knows about them.
                    // We can't verify that synchronously on mount, so we drop them.
                    // The user can re-submit if needed; the backend deduplicates anyway.
                }
                // Don't add to cleaned → effectively removes all terminal + stale states
            });
            return cleaned; // start fresh every app launch
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount only

    const fetchVideos = useCallback(async (query: string) => {
        if (!query.trim()) { setVideos([]); setError("Please enter a search term."); return; }
        setIsLoading(true); setError(null); setVideos([]);
        try {
            const response = await fetch(`${API_BASE_URL}/search/youtube?q=${encodeURIComponent(query)}`,
                { method: 'GET', headers: { 'Content-Type': 'application/json' } });
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            const rawData: YoutubeApiResponse[] = await response.json();
            setVideos(rawData.map(v => ({
                id:         v.videoId,
                title:      v.title,
                thumbnail:  v.thumbnailUrl,
                duration:   formatDuration(v.duration),
                channel:    v.channelTitle,
                uploadedAt: new Date(v.publishedAt).toLocaleDateString(),
            })));
        } catch (err) {
            setError(`Failed to fetch videos: ${err instanceof Error ? err.message : 'Unknown error'}`);
        } finally {
            setIsLoading(false);
        }
    }, [setVideos]);

    const handleProcessVideo = useCallback(async (videoId: string) => {
        const currentStatus = taskStatuses[videoId];
        if (currentStatus && currentStatus !== 'FAILED') {
            toast.error(`Processing is already ${currentStatus.toLowerCase()} for this video.`);
            return;
        }

        setTaskStatuses(prev => ({ ...prev, [videoId]: 'PENDING' }));
        const toastId = toast.loading(`Launching processing for ${videoId}...`);

        try {
            const video   = videos.find(v => v.id === videoId);
            const response = await fetch(`${API_BASE_URL}/api/audio/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoId, duration: video?.duration, videoTitle: video?.title }),
            });
            if (response.status === 409) {
                const msg = await response.text();
                console.log('[409] Already processed:', msg);
                toast.dismiss(toastId);
                setAlertMessage(msg);
                setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
                return;
            }
            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`${response.status} - ${errorBody}`);
            }
            toast.success('Processing accepted. Tracking status...', { id: toastId });
        } catch (err) {
            setTaskStatuses(prev => {
                const next = { ...prev };
                delete next[videoId]; // FIX 2: remove on failure, don't leave FAILED forever
                return next;
            });
            toast.error(`Failed to start processing.`, { id: toastId });
        }
    }, [taskStatuses, setTaskStatuses, videos]);

    const pollTaskStatus = useCallback(async (videoId: string, currentStatus: TaskStatus) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/audio/status?videoId=${encodeURIComponent(videoId)}`);

            if (response.status === 404) {
                // Task disappeared — clean up and stop polling
                setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
                toast.error(`Task disappeared for ${videoId}.`, { id: videoId });
                return true;
            }
            if (!response.ok) throw new Error(`Status API error: ${response.status}`);

            const status = (await response.text()).trim() as TaskStatus;

            if (status !== currentStatus) {
                setTaskStatuses(prev => ({ ...prev, [videoId]: status }));
                if      (status === 'DOWNLOADING') toast.loading('Downloading audio...', { id: videoId });
                else if (status === 'SEPARATING')  toast.loading('Separating audio tracks...', { id: videoId });
            }

            if (status === 'COMPLETED') {
                toast.success(`Processing complete for ${videoId}!`, { id: videoId });
                // ─────────────────────────────────────────────────────────────
                // FIX 2: Remove terminal statuses from localStorage immediately.
                // The library page fetches the real status from the DB anyway.
                // This keeps localStorage lean regardless of how long the app runs.
                // ─────────────────────────────────────────────────────────────
                setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
                return true;
            }
            if (status === 'FAILED') {
                toast.error(`Processing failed for ${videoId}.`, { id: videoId });
                // Remove FAILED too — don't accumulate dead entries
                setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
                return true;
            }

            return false;
        } catch (error) {
            console.error(`Polling failed for ${videoId}:`, error);
            setTaskStatuses(prev => { const n = {...prev}; delete n[videoId]; return n; });
            toast.error(`Polling failed for ${videoId}.`, { id: videoId });
            return true;
        }
    }, [setTaskStatuses]);

    // Polling interval — only for genuinely active tasks
    useEffect(() => {
        const activeTasks = Object.entries(taskStatuses).filter(([, s]) =>
            s === 'PENDING' || s === 'DOWNLOADING' || s === 'SEPARATING'
        );
        if (activeTasks.length === 0) return;

        const intervalId = setInterval(() => {
            activeTasks.forEach(([videoId, status]) => pollTaskStatus(videoId, status as TaskStatus));
        }, 3000);

        return () => clearInterval(intervalId);
    }, [taskStatuses, pollTaskStatus]);

    interface SearchEvent extends React.FormEvent<HTMLFormElement> {}
    const handleSearch = (e: SearchEvent): void => { e.preventDefault(); fetchVideos(searchQuery); };

    return (
        <div className="min-h-screen bg-background">
            {/* ── Backend alert modal ── */}
            <AlertModal
                message={alertMessage}
                onClose={() => setAlertMessage(null)}
                title="Already Processed"
                variant="warning"
            />
            <div className="px-6 py-6 space-y-6">
                <form onSubmit={handleSearch} className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search videos (e.g., Bob Marley)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                            data-testid="input-search"
                        />
                    </div>
                    <Button type="submit" data-testid="button-search" disabled={isLoading || searchQuery.trim() === ""}>
                        {isLoading ? 'Searching...' : 'Search'}
                    </Button>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {error && <p className="text-red-500 col-span-full">{error}</p>}
                    {isLoading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="space-y-3">
                                <Skeleton className="h-[225px] w-full rounded-xl" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[75%]" />
                                    <Skeleton className="h-4 w-[50%]" />
                                </div>
                            </div>
                        ))
                    ) : (
                        videos.map(video => (
                            <VideoCard
                                key={video.id}
                                video={video}
                                onProcess={handleProcessVideo}
                                taskStatus={taskStatuses[video.id] || undefined}
                            />
                        ))
                    )}
                    {!isLoading && videos.length === 0 && !error && searchQuery && (
                        <p className="text-muted-foreground col-span-full">No videos found for "{searchQuery}".</p>
                    )}
                    {!isLoading && videos.length === 0 && !error && !searchQuery && (
                        <p className="text-muted-foreground col-span-full">Enter a term and click "Search" to find videos.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
