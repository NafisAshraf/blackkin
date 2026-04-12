"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

interface CustomScriptsConfig {
  headScripts?: string;
  bodyScripts?: string;
}

export default function CustomScriptsPage() {
  const config = useQuery(api.marketing.getSettings, { type: "customScripts" }) as CustomScriptsConfig | null | undefined;
  const upsertSettings = useMutation(api.marketing.upsertSettings);

  const [headScripts, setHeadScripts] = useState("");
  const [bodyScripts, setBodyScripts] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setHeadScripts(config.headScripts ?? "");
      setBodyScripts(config.bodyScripts ?? "");
    }
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertSettings({
        type: "customScripts",
        config: {
          headScripts: headScripts.trim(),
          bodyScripts: bodyScripts.trim(),
        },
      });
      toast.success("Settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Custom Scripts</h1>
        <p className="text-muted-foreground mt-1">
          Scripts added here will be injected into your storefront pages.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Head Scripts</CardTitle>
            <CardDescription>Injected in &lt;head&gt; of every page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="headScripts" className="sr-only">Head Scripts</Label>
            <Textarea
              id="headScripts"
              value={headScripts}
              onChange={(e) => setHeadScripts(e.target.value)}
              placeholder={'<script>\n  // Your custom head script here\n</script>'}
              rows={10}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Body Scripts</CardTitle>
            <CardDescription>Injected before &lt;/body&gt; of every page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="bodyScripts" className="sr-only">Body Scripts</Label>
            <Textarea
              id="bodyScripts"
              value={bodyScripts}
              onChange={(e) => setBodyScripts(e.target.value)}
              placeholder={'<script>\n  // Your custom body script here\n</script>'}
              rows={10}
              className="font-mono text-sm"
            />
          </CardContent>
        </Card>

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
      </form>
    </div>
  );
}
