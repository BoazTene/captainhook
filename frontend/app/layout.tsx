import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaptainHook",
  description: "Daily mission dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
