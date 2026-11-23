import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ModeProvider } from "@/lib/mode";
import { Header, BottomNav } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "함께 보는 무대 — 올림픽공원 배리어프리 공연 관람 안내",
  description:
    "휠체어 이용자·고령자·저시력 관객을 위해 올림픽공원 공연장까지 계단 없는 길, 휠체어석 시야, 붐비지 않는 도착 시간을 안내합니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">
        <ModeProvider>
          <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-grey-100">
            <Header />
            <main className="flex flex-1 flex-col">{children}</main>
            <BottomNav />
          </div>
        </ModeProvider>
      </body>
    </html>
  );
}
