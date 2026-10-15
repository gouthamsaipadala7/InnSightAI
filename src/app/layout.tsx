import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "InnSight AI",
  description:
    "Multi-tenant hotel operations platform with AI-driven demand forecasting.",
  icons: {
    icon: [
      { url: "/logo/favicon-32.png", sizes: "32x32" },
      { url: "/logo/favicon-16.png", sizes: "16x16" },
    ],
    apple: "/logo/apple-touch-icon-180.png",
  },
  openGraph: {
    images: ["/logo/social-share-1200x630.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
