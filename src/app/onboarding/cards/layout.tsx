import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose your cards — LedgerKit",
  description:
    "Personalise LedgerKit with the credit cards you use so expenses and rewards stay relevant.",
};

export default function CardOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
