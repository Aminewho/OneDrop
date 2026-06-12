// theme/themeManager.ts

export interface BrandingConfig {
    theme: string;
    logo: string;
    customer: string;
}

export const applyBranding = (config: BrandingConfig) => {

    document.documentElement.setAttribute(
        "data-theme",
        config.theme
    );

    localStorage.setItem(
        "branding",
        JSON.stringify(config)
    );
};

export const getBranding = (): BrandingConfig | null => {

    const stored = localStorage.getItem("branding");

    if (!stored) return null;

    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
};