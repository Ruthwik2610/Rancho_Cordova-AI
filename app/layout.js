import './globals.css';

export const metadata = {
  title: 'Rancho Cordova AI',
  description: 'AI Assistant for City Services & Energy',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}