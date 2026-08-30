import { Inter } from "next/font/google";
import "./globals.css";
import ClientLogger from "@/components/ClientLogger";
import KillSwitchWrapper from "@/components/KillSwitchWrapper";

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: "SATSET Vidual",
  description: "SATSET Vidual Bot - Automated Web Dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${inter.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientLogger />
        <KillSwitchWrapper>
          {children}
        </KillSwitchWrapper>
      </body>
    </html>
  );
}
