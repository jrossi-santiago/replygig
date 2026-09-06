import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReplyGig",
  description: "Open asks on X, before the replies pile up.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
