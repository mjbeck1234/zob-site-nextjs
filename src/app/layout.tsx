import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import Script from 'next/script';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ClientToaster from '@/components/ClientToaster';
import { site } from '@/lib/site';
import { Jost, Montserrat } from 'next/font/google';

export const dynamic = 'force-dynamic';

const jost = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  weight: ['300', '400', '500', '600', '700'],
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700'],
});

const siteOrigin = `https://${site.domain.replace(/^https?:\/\//, '')}`;
const siteUrl = new URL(siteOrigin);
const siteDescription = 'Training, events, staffing, pilot resources, and controller tools for the Cleveland ARTCC.';

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: site.name,
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: siteDescription,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: siteOrigin,
    siteName: site.name,
    title: site.name,
    description: siteDescription,
    images: [
      {
        url: site.logoUrl,
        alt: `${site.name} logo`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.name,
    description: siteDescription,
    images: [site.logoUrl],
  },
  icons: {
    icon: [{ url: '/favicon.ico' }],
    apple: [{ url: '/favicon.ico' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jost.variable} ${montserrat.variable}`}>
      {/* Suppress hydration warnings caused by browser extensions that inject attributes (e.g., Grammarly). */}
      <body suppressHydrationWarning>
        {/*
          Some browser extensions inject attributes like `fdprocessedid` into buttons/inputs *before* React hydrates.
          That causes Next.js hydration mismatch errors in dev.
          We strip those attributes before hydration to keep the DOM stable.
        */}
        <Script id="strip-ext-attrs" strategy="beforeInteractive">
          {`(() => {
  try {
    const attrs = ['fdprocessedid'];
    for (const a of attrs) {
      document.querySelectorAll('[' + a + ']').forEach((el) => el.removeAttribute(a));
    }
  } catch {
    // no-op
  }
})();`}
        </Script>
        <Navbar />
        <ClientToaster />
        <main className="min-h-[calc(100vh-64px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
