import type { Metadata } from "next";
import { GuestIdentityGate } from "@/components/guest-identity-gate";
import "./globals.css";

export const metadata: Metadata = {
  title: "吃瓜网",
  description: "图文视频混排的娱乐资讯吃瓜站"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <GuestIdentityGate>{children}</GuestIdentityGate>
      </body>
    </html>
  );
}
