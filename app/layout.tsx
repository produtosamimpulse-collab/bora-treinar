import type { Metadata } from "next";
import { Geist, Geist_Mono, Anton } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://boratreinar.amimpulse.com.br"),
  title: "Bora Treinar!",
  description: "Seu personal trainer com IA",
  appleWebApp: {
    title: "Bora Treinar!",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Bora Treinar!",
    description: "Seu personal trainer com IA",
    url: "https://boratreinar.amimpulse.com.br",
    siteName: "Bora Treinar!",
    images: [{ url: "/og-image.png", width: 1200, height: 1200 }],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bora Treinar!",
    description: "Seu personal trainer com IA",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
