import { useEffect } from "react";

interface AlertModalProps {
    message: string | null;
    onClose: () => void;
    title?: string;
    variant?: "warning" | "error" | "success" | "info";
}

const VARIANT_STYLES = {
    warning: {
        bg: "bg-primary/10",
        text: "text-primary",
        icon: "!"
    },
    error: {
        bg: "bg-destructive/10",
        text: "text-destructive",
        icon: "✕"
    },
    success: {
        bg: "bg-primary/10",
        text: "text-primary",
        icon: "✓"
    },
    info: {
        bg: "bg-primary/10",
        text: "text-primary",
        icon: "i"
    }
};

export default function AlertModal({
    message,
    onClose,
    title = "Notice",
    variant = "warning",
}: AlertModalProps) {

    useEffect(() => {
        if (!message) return;

        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handler);

        return () => {
            document.removeEventListener("keydown", handler);
        };
    }, [message, onClose]);

    if (!message) return null;

    const style = VARIANT_STYLES[variant];

    return (
        <div
            className="
                fixed inset-0 z-50
                flex items-center justify-center
                bg-background/80
                backdrop-blur-sm
                animate-in fade-in duration-200
            "
            onClick={onClose}
        >
            <div
                className="
                    bg-card
                    text-card-foreground
                    border border-border
                    rounded-2xl
                    shadow-xl
                    p-6
                    max-w-sm
                    w-full
                    mx-4
                    animate-in
                    fade-in
                    zoom-in-95
                    duration-150
                "
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 mb-5">
                    <div
                        className={`
                            w-8 h-8
                            rounded-full
                            ${style.bg}
                            flex items-center justify-center
                            shrink-0 mt-0.5
                        `}
                    >
                        <span className={`${style.text} text-sm font-bold`}>
                            {style.icon}
                        </span>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-foreground mb-1">
                            {title}
                        </p>

                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {message}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="
                        w-full
                        py-2.5
                        rounded-xl
                        bg-primary
                        hover:bg-primary/90
                        text-primary-foreground
                        text-sm
                        font-medium
                        transition-all
                        active:scale-[0.98]
                        shadow-lg
                    "
                >
                    OK
                </button>
            </div>
        </div>
    );
}