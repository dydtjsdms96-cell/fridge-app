import type { Metadata, Viewport } from "next";
import { DM_Mono, Noto_Sans_KR } from "next/font/google";
import { CapacitorShell } from "@/components/capacitor/capacitor-shell";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
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
      className={`${notoSansKr.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <CapacitorShell>{children}</CapacitorShell>
      </body>
    </html>
  );
}
