export const applyTheme = (themeName: string) => {
    document.documentElement.setAttribute(
        "data-theme",
        themeName
    );

    localStorage.setItem("theme", themeName);
};