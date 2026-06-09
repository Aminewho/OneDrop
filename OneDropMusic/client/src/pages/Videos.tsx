import { useState, useEffect, useCallback, useRef } from "react";
import VideoCard from "@/components/VideoCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "react-hot-toast";
import AlertModal from "@/components/AlertModal";
import { Search, Link2, X, Youtube } from "lucide-react";

const API_BASE_URL = "http://localhost:8081";
const LS_SEARCH_QUERY_KEY  = "videoSearchQuery_page";
const LS_VIDEOS_KEY        = "videoResults_page";
const LS_TASK_STATUSES_KEY = "videoTaskStatuses_page";

export type TaskStatus =
  | "PENDING" | "DOWNLOADING" | "SEPARATING"
  | "FAILED"  | "COMPLETED"   | "UNKNOWN"
  | undefined;

interface YoutubeApiResponse {
  videoId: string; title: string; channelTitle: string;
  thumbnailUrl: string; publishedAt: string; duration: string;
}
interface Video {
  id: string; title: string; thumbnail: string;
  duration: string; channel: string; uploadedAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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

function formatDuration(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return "N/A";
  const h = parseInt(m[1] || "0"), min = parseInt(m[2] || "0"), s = parseInt(m[3] || "0");
  const p: string[] = [];
  if (h > 0) { p.push(String(h)); p.push(String(min).padStart(2, "0")); }
  else p.push(String(min));
  p.push(String(s).padStart(2, "0"));
  return p.join(":");
}

/** Returns YouTube video ID if input is a URL, otherwise null */
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

// ─────────────────────────────────────────────────────────────────────────────
export default function Videos() {
  const [searchQuery,  setSearchQuery]  = useLocalStorageState<string>(LS_SEARCH_QUERY_KEY, "");
  const [videos,       setVideos]       = useLocalStorageState<Video[]>(LS_VIDEOS_KEY, []);
  const [taskStatuses, setTaskStatuses] = useLocalStorageState<Record<string, TaskStatus>>(LS_TASK_STATUSES_KEY, {});
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  // "url" mode when input is a YouTube link
  const [inputMode, setInputMode] = useState<"search" | "url">("search");
  const inputRef = useRef<HTMLInputElement>(null);

  // Clean stale localStorage on mount
  useEffect(() => {
    setTaskStatuses(() => ({}));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect URL vs search query as user types
  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setInputMode(extractYoutubeId(value) ? "url" : "search");
  };

  // ── Fetch by search query ─────────────────────────────────────────────────
  const fetchByQuery = useCallback(async (query: string) => {
    if (!query.trim()) { setError("Please enter a search term."); return; }
    setIsLoading(true); setError(null); setVideos([]);
    try {
      const res = await fetch(`${API_BASE_URL}/search/youtube?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: YoutubeApiResponse[] = await res.json();
      setVideos(data.map(v => ({
        id: v.videoId, title: v.title, thumbnail: v.thumbnailUrl,
        duration: formatDuration(v.duration), channel: v.channelTitle,
        uploadedAt: new Date(v.publishedAt).toLocaleDateString(),
      })));
    } catch (e) {
      setError(`Search failed: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally { setIsLoading(false); }
  }, [setVideos]);

  // ── Fetch single video by ID (URL mode) ──────────────────────────────────
  const fetchByUrl = useCallback(async (videoId: string) => {
    setIsLoading(true); setError(null); setVideos([]);
    try {
      // Ask the backend for this specific video's info
      const res = await fetch(`${API_BASE_URL}/search/youtube?q=${encodeURIComponent(videoId)}&type=id`);
      if (res.ok) {
        const data: YoutubeApiResponse[] = await res.json();
        const match = data.find(v => v.videoId === videoId);
        if (match) {
          setVideos([{
            id: match.videoId, title: match.title, thumbnail: match.thumbnailUrl,
            duration: formatDuration(match.duration), channel: match.channelTitle,
            uploadedAt: new Date(match.publishedAt).toLocaleDateString(),
          }]);
          return;
        }
      }
      // Fallback: construct minimal card from the ID alone (thumbnail is always public)
      setVideos([{
        id: videoId, title: "Loading title...", channel: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        duration: "--:--", uploadedAt: "",
      }]);
    } catch {
      setVideos([{
        id: videoId, title: "YouTube Video", channel: "YouTube",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        duration: "--:--", uploadedAt: "",
      }]);
    } finally { setIsLoading(false); }
  }, [setVideos]);

  // ── Handle form submit ────────────────────────────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractYoutubeId(searchQuery);
    if (id) fetchByUrl(id);
    else    fetchByQuery(searchQuery);
  };

  const clearSearch = () => {
    setSearchQuery(""); setVideos([]); setError(null);
    setInputMode("search");
    inputRef.current?.focus();
  };

  // ── Process video ─────────────────────────────────────────────────────────
  const handleProcessVideo = useCallback(async (videoId: string) => {
    const cur = taskStatuses[videoId];
    if (cur && cur !== "FAILED") {
      toast.error(`Already ${cur.toLowerCase()} for this video.`);
      return;
    }
    setTaskStatuses(prev => ({ ...prev, [videoId]: "PENDING" }));
    const toastId = toast.loading("Starting processing...");
    try {
      const video = videos.find(v => v.id === videoId);
      const res = await fetch(`${API_BASE_URL}/api/audio/process`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, duration: video?.duration, videoTitle: video?.title }),
      });
      if (res.status === 409) {
        const msg = await res.text();
        toast.dismiss(toastId);
        setAlertMessage(msg);
        setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
        return;
      }
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
      toast.success("Processing started.", { id: toastId });
    } catch {
      setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
      toast.error("Failed to start processing.", { id: toastId });
    }
  }, [taskStatuses, setTaskStatuses, videos]);

  // ── Poll status ───────────────────────────────────────────────────────────
  const pollTaskStatus = useCallback(async (videoId: string, cur: TaskStatus) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/audio/status?videoId=${encodeURIComponent(videoId)}`);
      if (res.status === 404) {
        setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
        return true;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const status = (await res.text()).trim() as TaskStatus;
      if (status !== cur) {
        setTaskStatuses(prev => ({ ...prev, [videoId]: status }));
        if      (status === "DOWNLOADING") toast.loading("Downloading audio...", { id: videoId });
        else if (status === "SEPARATING")  toast.loading("Separating stems...",  { id: videoId });
      }
      if (status === "COMPLETED" || status === "FAILED") {
        status === "COMPLETED"
          ? toast.success("Ready!", { id: videoId })
          : toast.error("Failed.", { id: videoId });
        setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
        return true;
      }
      return false;
    } catch {
      setTaskStatuses(prev => { const n = { ...prev }; delete n[videoId]; return n; });
      return true;
    }
  }, [setTaskStatuses]);

  useEffect(() => {
    const active = Object.entries(taskStatuses).filter(([, s]) =>
      s === "PENDING" || s === "DOWNLOADING" || s === "SEPARATING"
    );
    if (!active.length) return;
    const id = setInterval(() => {
      active.forEach(([vid, s]) => pollTaskStatus(vid, s as TaskStatus));
    }, 3000);
    return () => clearInterval(id);
  }, [taskStatuses, pollTaskStatus]);

  const isUrlMode = inputMode === "url";

  return (
    <div className="min-h-screen bg-background">
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} title="Already Processed" variant="warning" />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Discover</h1>
          <p className="text-sm text-muted-foreground">Search YouTube or paste a video link to extract stems</p>
        </div>

        {/* ── Search / URL bar ───────────────────────────────────────────── */}
        <form onSubmit={handleSearch}>
          <div className="flex gap-3 items-center">

            {/* Input wrapper */}
            <div className="relative flex-1 group">
              {/* Icon: switches between search and URL indicator */}
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-all duration-200">
                {isUrlMode
                  ? <Youtube className="w-4 h-4 text-primary" />
                  : <Search  className="w-4 h-4 text-muted-foreground" />
                }
              </div>

              <Input
                ref={inputRef}
                value={searchQuery}
                onChange={e => handleInputChange(e.target.value)}
                placeholder="Search artists, songs… or paste a YouTube URL"
                className="pl-10 pr-10 h-11 bg-card border-border/60 focus:border-primary/60 transition-colors text-sm placeholder:text-muted-foreground/60 rounded-xl"
                data-testid="input-search"
              />

              {/* URL mode badge */}
              {isUrlMode && (
                <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                  <Link2 className="w-3 h-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary tracking-wide">URL</span>
                </div>
              )}

              {/* Clear button */}
              {searchQuery && (
                <button type="button" onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="h-11 px-6 rounded-xl font-medium shrink-0"
              data-testid="button-search"
            >
              {isLoading ? "Searching…" : isUrlMode ? "Load video" : "Search"}
            </Button>
          </div>

          {/* URL detected hint */}
          {isUrlMode && (
            <p className="mt-2 ml-1 text-xs text-primary/80 flex items-center gap-1.5">
              <Link2 className="w-3 h-3" />
              YouTube URL detected — click <strong>Load video</strong> to fetch it directly
            </p>
          )}
        </form>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-destructive/8 border border-destructive/20 text-sm text-destructive">
            <X className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
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
        ) : videos.length > 0 ? (
          <>
            {/* Result count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {videos.length} result{videos.length !== 1 ? "s" : ""}
                {isUrlMode ? " for that URL" : ` for "${searchQuery}"`}
              </p>
            </div>
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
          </>
        ) : (
          /* Empty state */
          !error && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 border border-border/40 flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {searchQuery ? `No results for "${searchQuery}"` : "Start exploring"}
                </p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {searchQuery
                    ? "Try a different search term or paste a YouTube URL directly"
                    : "Search for a song, artist, or paste a YouTube URL to get started"}
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}