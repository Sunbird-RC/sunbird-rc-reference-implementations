import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Applications of Sunbird RC',
  description: 'Explore how Sunbird RC enables trusted registries and portable credentials across sectors.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
