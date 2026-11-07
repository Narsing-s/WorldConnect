import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WorldConnect — One world. Millions of connections.",
  description: "Meet people, exchange ideas, learn together and discover opportunities across the world.",
  applicationName: "WorldConnect",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
