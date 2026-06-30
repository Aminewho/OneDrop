import { Clock, X, Trash2 } from "lucide-react";

interface SearchHistoryDropdownProps {
    history: string[];
    onSelect:  (q: string) => void;
    onRemove:  (q: string) => void;
    onClear:   () => void;
    visible:   boolean;
}

/**
 * Drop-down panel shown below the search input when it is focused
 * and there is history to display.
 *
 * Parent is responsible for positioning (relative container).
 */
export default function SearchHistoryDropdown({
    history, onSelect, onRemove, onClear, visible,
}: SearchHistoryDropdownProps) {
    if (!visible || history.length === 0) return null;

    return (
         
        <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-xl border border-border/50 bg-card shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Recent searches
                </span>
                <button
                type="button"  
                    onClick={onClear}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                    <Trash2 className="w-3 h-3" /> Clear all
                </button>
            </div>

            {/* Items */}
            <ul>
                {history.map((q, i) => (
                    <li key={i} className="flex items-center group">
                        <button
                            type="button"
                            onClick={() => onSelect(q)}
                            className="flex items-center gap-2.5 flex-1 px-3 py-2.5 text-sm text-left hover:bg-muted/30 transition-colors"
                        >
                            <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                            <span className="truncate text-foreground">{q}</span>
                        </button>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); onRemove(q); }}
                            className="pr-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
                            title="Remove"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
        
       
    );
     
}