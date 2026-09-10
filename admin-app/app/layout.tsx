import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Training programs | HSE Informer',
  icons: { icon: '/favicon.svg' },
  description:
    'Manage foundational safety training across your sites. HSE Informer administrator workspace preview.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
