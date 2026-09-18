import bleuLogo from "@/assets/logos/bleu.png";
import eimanarLogo from "@/assets/logos/eimanar.png";
import orangé from "@/assets/logos/orangé.png";
import dimouzikaLogo from "@/assets/logos/dimouzika.png";

// To add a new client: drop the PNG in this folder and add one line below.
// No dimensions needed — the sidebar container handles sizing automatically.
export const LOGOS: Record<string, { src: string }> = {
    bleu:      { src: bleuLogo },
    eimanar:   { src: eimanarLogo },
    orangé:    { src: orangé },
    dimouzika: { src: dimouzikaLogo },
};
