import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rancho Cordova AI - City Assistant',
  description: 'AI-powered assistant for Rancho Cordova city services and energy efficiency',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}