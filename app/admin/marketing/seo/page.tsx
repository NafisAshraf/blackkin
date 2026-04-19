"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface SeoConfig {
  defaultTitle?: string;
  defaultDescription?: string;
}

export default function SeoSettingsPage() {
  const config = useQuery(api.marketing.getSettings, { type: "seo" }) as
    | SeoConfig
    | null
    | undefined;
  const upsertSettings = useMutation(api.marketing.upsertSettings);

  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setDefaultTitle(config.defaultTitle ?? "");
      setDefaultDescription(config.defaultDescription ?? "");
    }
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertSettings({
        type: "seo",
        config: {
          defaultTitle: defaultTitle.trim(),
          defaultDescription: defaultDescription.trim(),
        },
      });
      toast.success("Settings saved");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  if (config === undefined) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">SEO Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure default meta tags that appear in search engine results when
          no page-specific SEO is set.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Default Meta Tags</CardTitle>
            <CardDescription>
              These values are used as fallbacks across your storefront when a
              page does not define its own title or description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="defaultTitle">Default Meta Title</Label>
              <Input
                id="defaultTitle"
                value={defaultTitle}
                onChange={(e) => setDefaultTitle(e.target.value)}
                placeholder="Blackkin — Premium Essentials"
              />
              <p className="text-xs text-muted-foreground">
                Recommended length: 50–60 characters.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultDescription">
                Default Meta Description
              </Label>
              <Textarea
                id="defaultDescription"
                value={defaultDescription}
                onChange={(e) => setDefaultDescription(e.target.value)}
                placeholder="Premium quality underwear and everyday essentials."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Recommended length: 120–158 characters.
              </p>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
