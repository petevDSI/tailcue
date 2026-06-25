import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import BottomTabBar from '@/components/BottomTabBar'
import Script from 'next/script'

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
      <head>
        <Script
          id="impact-stat"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A7435639-31b3-4f2b-a4eb-8c10ebfb87611.js','script','impactStat',document,window);impactStat('transformLinks');impactStat('trackImpression');`
          }}
        />
      </head>
      <body className="font-sans antialiased" style={{ backgroundColor: '#FFFBF0' }}>
        {children}
        <BottomTabBar />
      </body>
    </html>
  );
}
