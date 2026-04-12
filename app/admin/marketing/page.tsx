"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart2, Code2, Megaphone, Search } from "lucide-react";

const MARKETING_CARDS = [
  {
    href: "/admin/marketing/facebook",
    icon: Megaphone,
    title: "Facebook Pixel",
    description: "Configure Facebook Pixel and server-side Conversions API for ad tracking and retargeting.",
  },
  {
    href: "/admin/marketing/google",
    icon: BarChart2,
    title: "Google Analytics",
    description: "Set up GA4 measurement to track traffic, conversions, and customer behaviour.",
  },
  {
    href: "/admin/marketing/seo",
    icon: Search,
    title: "SEO Settings",
    description: "Configure global meta tags, Open Graph defaults, and structured data for search engines.",
  },
  {
    href: "/admin/marketing/scripts",
    icon: Code2,
    title: "Custom Scripts",
    description: "Inject custom head or body scripts for third-party tools, heatmaps, or chat widgets.",
  },
];

export default function MarketingHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect tracking tools and configure your marketing integrations.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MARKETING_CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="group">
            <Card className="h-full transition-colors hover:border-foreground/30 hover:bg-accent/30 cursor-pointer">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted group-hover:bg-background transition-colors">
                    <card.icon className="h-5 w-5 text-foreground" />
                  </div>
                  <CardTitle className="text-base">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-xs leading-relaxed">{card.description}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
