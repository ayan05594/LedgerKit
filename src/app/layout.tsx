import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "LedgerKit — spend and rewards",
  description:
    "Track spending across six Indian cards, see what each one actually earned after caps, and chase down every refund and reimbursement.",
};

export const viewport: Viewport = {
  themeColor: "#F4F5F7",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Loaded over the network when available; falls back to the system
            grotesque stack declared in globals.css otherwise. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                borderRadius: "10px",
                border: "1px solid #E3E6EC",
                fontSize: "0.875rem",
              },
            }}
          />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
