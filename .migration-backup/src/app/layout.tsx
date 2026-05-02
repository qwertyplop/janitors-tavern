import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import { AuthWrapper } from '@/components/providers/AuthWrapper';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: "Janitor's Tavern - Proxy UI",
  description: 'SillyTavern-like proxy control panel for JanitorAI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
        <AuthWrapper>
          <ConditionalLayout>{children}</ConditionalLayout>
        </AuthWrapper>
      </body>
    </html>
  );
}
