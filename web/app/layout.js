import "./globals.css";

export const metadata = {
  title: "Meeting Notes",
  description: "Self-hosted meeting notes app scaffold",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
