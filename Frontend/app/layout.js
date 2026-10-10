import { Cairo, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import PwaRegister from "@/components/PwaRegister";
import AiAssistant from "@/components/AiAssistant";
import SubscriptionGate from "@/components/SubscriptionGate";
import UpdateGate from "@/components/UpdateGate";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "مخزن نيللي للميكاب | Nelly Cosmetics Desktop",
  description: "نظام إدارة وجرد مخزن مستحضرات التجميل والميكاب — Nelly Desktop",
  applicationName: "مخزن Nelly Desktop",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#db2777",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${outfit.variable}`} data-scroll-behavior="smooth">
      <body>
        <PwaRegister />
        <AuthProvider>
          {children}
          <AiAssistant />
          <SubscriptionGate />
          <UpdateGate />
        </AuthProvider>
      </body>
    </html>
  );
}
