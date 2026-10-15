import { Figtree as Font } from "next/font/google";

const font = Font({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  style: ["normal"],
});

const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#152238" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

const className = `${font.variable} font-sans  antialiased`;

export { font, viewport, className };
