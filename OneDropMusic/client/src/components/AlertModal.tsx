import { useEffect } from "react";

interface AlertModalProps {
    message: string | null;
    onClose: () => void;
    title?: string;
    variant?: "warning" | "error" | "success" | "info";
}

const VARIANT_STYLES = {
    warning: { bg: "bg-amber-500/15",  text: "text-amber-400",  icon: "!" },
    error:   { bg: "bg-red-500/15",    text: "text-red-400",    icon: "✕" },
    success: { bg: "bg-green-500/15",  text: "text-green-400",  icon: "✓" },
    info:    { bg: "bg-sky-500/15",    text: "text-sky-400",    icon: "i" }, // Updated to match app blue
};

export default function AlertModal({
    message,
    onClose,
    title = "Notice",
    variant = "warning",
}: AlertModalProps) {
    // Close on Escape key
    useEffect(() => {
        if (!message) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [message, onClose]);

    if (!message) return null;

    const style = VARIANT_STYLES[variant];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-[#121214] border border-white/10 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 mb-5">
                    <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <span className={`${style.text} text-sm font-bold`}>{style.icon}</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-white mb-1">{title}</p>
                        <p className="text-sm text-gray-400 leading-relaxed">{message}</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium transition-all active:scale-98 shadow-md shadow-sky-500/10"
                >
                    OK
                </button>
            </div>
        </div>
    );
}