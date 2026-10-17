export const metadata = {
  title: 'NexTalk',
  description: 'Chat realtime',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}