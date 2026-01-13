import './globals.css';

export const metadata = {
  title: 'Rancho Cordova AI',
  description: 'City Services & Energy Assistant',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}