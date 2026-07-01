import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVM Brasil MVP",
  description: "Automated valuation modeling MVP for Brazilian real estate appraisal studies."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
