import type { Metadata } from "next";
import "./globals.css";
import { WorkspaceProvider } from "@/components/workspace";
import { Shell } from "@/components/shell";
export const metadata: Metadata = {
  title: "AMLAAAK — Real estate intelligence",
  description:
    "Transparent Iranian residential sale analytics and reproducible price modeling.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
