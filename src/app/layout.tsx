import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomTabBar from '@/components/BottomTabBar'

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Tailcue",
  description: "Smart tools for pet owners — vet pricing, insurance, and chronic care tracking",
  other: {
    'impact-site-verification': 'aa7e31e1-a488-44ee-8798-4e75be2f21ce',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased" style={{ backgroundColor: '#FFFBF0' }}>
        {children}
        <BottomTabBar />
      </body>
    </html>
  );
}
