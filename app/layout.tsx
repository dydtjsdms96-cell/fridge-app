import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { CapacitorShell } from "@/components/capacitor/capacitor-shell";
import "./globals.css";

const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  display: "swap",
  weight: "45 920",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "프레시포켓",
  description: "냉장고 재고와 유통기한을 한눈에 관리하세요",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2E5B4C",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendard.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans tabular-nums">
        <CapacitorShell>{children}</CapacitorShell>
      </body>
    </html>
  );
}
