import { useState, useEffect, useCallback, useRef } from "react";
import VideoCard from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";
import AlertModal from "@/components/AlertModal";
import { Search, Link2, X } from "lucide-react";
import SearchHistoryDropdown from "@/components/SearchHistoryDropdown";
import { useSearchHistory } from "@/hooks/useSearchHistory";

const API_BASE_URL = "http://localhost:8081";
const LS_SEARCH_QUERY_KEY  = "videoSearchQuery_page";
const LS_VIDEOS_KEY        = "videoResults_page";
const LS_TASK_STATUSES_KEY = "videoTaskStatuses_page";

export type TaskStatus =
  | "PENDING" | "DOWNLOADING" | "SEPARATING"
  | "FAILED"  | "COMPLETED"   | "UNKNOWN"
  | undefined;

interface YoutubeApiResponse {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
views?: string; // Matches Java VideoDto "views" property
}

export interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  views: string;
}

function useLocalStorageState<T>(key: string, def: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const load = (): T => {
    try { const s = localStorage.getItem(key); if (s) return JSON.parse(s) as T; }
    catch { localStorage.removeItem(key); }
    return def;
  };
  const [state, setState] = useState<T>(load);
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)); } catch {} }, [key, state]);
  return [state, setState];
}
function formatViewCount(views?: string | null): string {
  if (!views || views.trim() === "") return "N/A";
  return views;
}

function extractYoutubeId(input: string): string | null {
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = input.match(p);
    if (match) return match[1];
  }
  return null;
}

export default function Videos() {
  const [searchQuery,  setSearchQuery]  = useLocalStorageState<string>(LS_SEARCH_QUERY_KEY, "");
  const [videos,       setVideos]       = useLocalStorageState<Video[]>(LS_VIDEOS_KEY, []);
  const [taskStatuses, setTaskStatuses] = useLocalStorageState<Record<string, TaskStatus>>(LS_TASK_STATUSES_KEY, {});
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [inputMode,    setInputMode]    = useState<"search" | "url">("search");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { history, push, remove, clear } = useSearchHistory("youtube");

  const hasResults = videos.length > 0;

  useEffect(() => { setTaskStatuses(() => ({})); }, []); // eslint-disable-line

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setInputMode(extractYoutubeId(value) ? "url" : "search");
  };

  const fetchByQuery = useCallback(async (query: string) => {
    if (!query.trim()) { setError("Please enter a search term."); return; }
    setIsLoading(true); setError(null); setVideos([]);
    try {
      const res = await fetch(`${API_BASE_URL}/search/youtube?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: YoutubeApiResponse[] = await res.json();
      setVideos(data.map(v => ({
        id: v.videoId,
        title: v.title,
        thumbnail: v.thumbnailUrl,
        channel: v.channelTitle,
        views: formatViewCount(v.views),
      })));
    } catch (e) {
      setError(`Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally { setIsLoading(false); }
  }, [setVideos]);

  const fetchByUrl = useCallback(async (videoId: string) => {
    setIsLoading(true); setError(null); setVideos([]);
    try {
      const res = await fetch(`${API_BASE_URL}/search/youtube?q=${encodeURIComponent(videoId)}&type=id`);
      if (res.ok) {
        const data: YoutubeApiResponse[] = await res.json();
        const match = data.find(v => v.videoId === videoId);
        if (match) {
          setVideos([{
            id: match.videoId,
            title: match.title,
            thumbnail: match.thumbnailUrl,
            channel: match.channelTitle,
            views: formatViewCount(match.views),
          }]);
          return;
        }
      }
      setVideos([{
        id: videoId,
        title: "YouTube Video",
        channel: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        views: "N/A",
      }]);
    } catch {
      setVideos([{
        id: videoId,
        title: "YouTube Video",
        channel: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        views: "N/A",
      }]);
    } finally { setIsLoading(false); }
  }, [setVideos]);

  const performSearch = useCallback((value: string) => {
    const term = value.trim();
    if (!term) return;

    setIsDropdownVisible(false);
    push(term);

    const id = extractYoutubeId(term);
    if (id) fetchByUrl(id); else fetchByQuery(term);
  }, [fetchByQuery, fetchByUrl, push]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery(""); setVideos([]); setError(null);
    setInputMode("search"); setIsDropdownVisible(false); inputRef.current?.focus();
  };

  const handleProcessVideo = useCallback(async (videoId: string) => {
    const cur = taskStatuses[videoId];
    if (cur && cur !== "FAILED") { toast.error(`Already ${cur.toLowerCase()} for this video.`); return; }
    setTaskStatuses(prev => ({ ...prev, [videoId]: "PENDING" }));
    const toastId = toast.loading("Starting processing...");
    try {
      const video = videos.find(v => v.id === videoId);
      const res = await fetch(`${API_BASE_URL}/api/audio/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, videoTitle: video?.title }),
      });
      if (res.status === 409) {
        const msg = await res.text();
        toast.dismiss(toastId); setAlertMessage(msg);
        setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; }); return;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      toast.success("Processing started.", { id: toastId });
    } catch {
      setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
      toast.error("Failed to start processing.", { id: toastId });
    }
  }, [taskStatuses, setTaskStatuses, videos]);

  const pollTaskStatus = useCallback(async (videoId: string, cur: TaskStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audio/status?videoId=${encodeURIComponent(videoId)}`);
      if (res.status === 404) { setTaskStatuses(prev => { const n={...prev}; delete n[videoId]; return n; }); return true; }
      if (!res.ok) throw new Error();
      const status = (await res.text()).trim() as TaskStatus;
      if (status !== cur) {
        setTaskStatuses(prev => ({ ...prev, [videoId]: status }));
        if (status === "DOWNLOADING") toast.loading("Downloading...", { id: videoId });
        else if (status === "SEPARATING") toast.loading("Separating stems...", { id: videoId });
      }
      if (status === "COMPLETED" || status === "FAILED") {
        status === "COMPLETED" ? toast.success("Ready!", { id: videoId }) : toast.error("Failed.", { id: videoId });
        setTaskStatuses(prev => { const n={...prev}; delete n[videoId]; return n; }); return true;
      }
      return false;
    } catch { setTaskStatuses(prev => { const n={...prev}; delete n[videoId]; return n; }); return true; }
  }, [setTaskStatuses]);

  useEffect(() => {
    const active = Object.entries(taskStatuses).filter(([,s]) => s==="PENDING"||s==="DOWNLOADING"||s==="SEPARATING");
    if (!active.length) return;
    const id = setInterval(() => active.forEach(([vid,s]) => pollTaskStatus(vid, s as TaskStatus)), 3000);
    return () => clearInterval(id);
  }, [taskStatuses, pollTaskStatus]);

  const isUrlMode = inputMode === "url";

  const SearchBar = (
    <form onSubmit={handleSearch} className="w-full">
      <div className="flex gap-3 items-center">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {isUrlMode ? (
              <Link2 className="w-4 h-4 text-primary" />
            ) : (
              <svg viewBox="0 0 20 14" className="w-5 h-3.5">
                <rect width="20" height="14" rx="3.5" fill="hsl(var(--primary))"/>
                <polygon points="8,3.5 8,10.5 14.5,7" fill="white"/>
              </svg>
            )}
          </div>

          <Input
            ref={inputRef}
            value={searchQuery}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => setIsDropdownVisible(true)}
            onBlur={() => setTimeout(() => setIsDropdownVisible(false), 180)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                performSearch(searchQuery);
              }
            }}
            placeholder="Search artists, songs… or paste a YouTube URL"
            className="pl-11 pr-10 h-12 bg-card border-border/50 focus:border-primary/50 transition-colors text-sm placeholder:text-muted-foreground/50 rounded-xl shadow-sm"
            data-testid="input-search"
            autoComplete="off"
          />

          <SearchHistoryDropdown
            history={history}
            visible={isDropdownVisible}
            onRemove={remove}
            onClear={clear}
            onSelect={(query) => {
              setSearchQuery(query);
              performSearch(query);
            }}
          />

          {isUrlMode && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
              <span className="text-[9px] font-bold text-primary tracking-wider uppercase">URL</span>
            </div>
          )}

          {searchQuery && (
            <button type="button" onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <Button type="submit" disabled={isLoading || !searchQuery.trim()}
          className="h-12 px-6 rounded-xl font-medium shrink-0 shadow-sm">
          {isLoading ? "Searching…" : isUrlMode ? "Load" : "Search"}
        </Button>
      </div>

      {isUrlMode && (
        <p className="mt-2 ml-1 text-xs text-primary/70 flex items-center gap-1.5">
          <Link2 className="w-3 h-3" />
          YouTube URL detected — click <strong>Load</strong> to fetch it directly
        </p>
      )}
    </form>
  );

  if (!hasResults && !isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} title="Already Downloaded" variant="warning" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-2xl space-y-10 text-center">
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2.5 mb-2">
                <svg viewBox="0 0 24 17" className="w-8 h-[22px]">
                  <rect width="24" height="17" rx="4" fill="hsl(var(--primary))"/>
                  <polygon points="9.5,4.5 9.5,12.5 17,8.5" fill="white"/>
                </svg>
                <span className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                  YouTube Search
                </span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
                Every song.<br />
                <span style={{ color: "hsl(var(--primary))" }}>Every layer.</span>
              </h1>
              <p className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Search any track or paste a YouTube link to isolate vocals, drums, bass and more.
              </p>
            </div>

            {SearchBar}

            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-sm text-destructive text-left">
                <X className="w-4 h-4 shrink-0" />{error}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground/60 uppercase tracking-widest">Popular searches</p>
              <div className="flex flex-wrap justify-center gap-2">
                {["Miles Davis", "Daft Punk", "Kendrick Lamar", "Pink Floyd", "The Beatles"].map(s => (
                  <button
                    key={s}
                    onClick={() => { setSearchQuery(s); fetchByQuery(s); }}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} title="Already Downloaded" variant="warning" />
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="max-w-2xl">{SearchBar}</div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-sm text-destructive">
            <X className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {!isLoading && videos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {videos.length} result{videos.length !== 1 ? "s" : ""}
            {isUrlMode ? " for that URL" : ` for "${searchQuery}"`}
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: isUrlMode ? 1 : 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {videos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onProcess={handleProcessVideo}
                taskStatus={taskStatuses[video.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}