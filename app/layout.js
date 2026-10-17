import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'NexTalk',
  description: 'Chat realtime',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className={inter.className}>
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0d0f12' }}>
        {children}
      </body>
    </html>
  );
}