import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "@/components/auth-gate";

export const metadata: Metadata = {
  title: "WorldConnect — One world. Millions of connections.",
  description: "Meet people, exchange ideas, learn together and discover opportunities across the world.",
  applicationName: "WorldConnect",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthGate>{children}</AuthGate></body></html>;
}
