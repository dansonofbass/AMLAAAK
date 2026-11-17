import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace";
import { Shell } from "@/components/shell";
import { Roboto, Vazirmatn } from "next/font/google";
const roboto = Roboto({
  subsets: ["latin"],
  variable: "--font-roboto",
  display: "swap",
});
const persian = Vazirmatn({
  subsets: ["arabic"],
  variable: "--font-persian",
  display: "swap",
});
export const metadata: Metadata = {
  title: "AMLAAAK — Real estate intelligence",
  description:
    "Transparent Iranian residential sale analytics and reproducible price modeling.",
  icons: { icon: "/favicon.svg", apple: "/brand/symbol.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${roboto.variable} ${persian.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to workspace
        </a>
        <WorkspaceProvider>
          <Shell>{children}</Shell>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
