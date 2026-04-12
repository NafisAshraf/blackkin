"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, Loader2 } from "lucide-react";

interface FacebookConfig {
  pixelId?: string;
  accessToken?: string;
  testEventCode?: string;
  browserEnabled?: boolean;
  serverEnabled?: boolean;
}

export default function FacebookSettingsPage() {
  const config = useQuery(api.marketing.getSettings, { type: "facebook" }) as FacebookConfig | null | undefined;
  const upsertSettings = useMutation(api.marketing.upsertSettings);

  const [pixelId, setPixelId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [testEventCode, setTestEventCode] = useState("");
  const [browserEnabled, setBrowserEnabled] = useState(false);
  const [serverEnabled, setServerEnabled] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setPixelId(config.pixelId ?? "");
      setAccessToken(config.accessToken ?? "");
      setTestEventCode(config.testEventCode ?? "");
      setBrowserEnabled(config.browserEnabled ?? false);
      setServerEnabled(config.serverEnabled ?? false);
    }
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertSettings({
        type: "facebook",
        config: {
          pixelId: pixelId.trim(),
          accessToken: accessToken.trim(),
          testEventCode: testEventCode.trim(),
          browserEnabled,
          serverEnabled,
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Facebook Conversion API</h1>
        <p className="text-muted-foreground mt-1">
          Connect your Facebook Pixel for browser-side and server-side conversion tracking.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Pixel Settings</CardTitle>
            <CardDescription>
              Your Pixel ID and access token are used to send conversion events to Facebook.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pixelId">Pixel / Dataset ID</Label>
              <Input
                id="pixelId"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                placeholder="1234567890123456"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessToken">Access Token</Label>
              <div className="relative">
                <Input
                  id="accessToken"
                  type={showToken ? "text" : "password"}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="EAAxxxxxxxx..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showToken ? "Hide token" : "Show token"}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testEventCode">Test Event Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="testEventCode"
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
                placeholder="TEST12345"
              />
              <p className="text-xs text-muted-foreground">
                Use this to test server events in the Facebook Events Manager.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="browserEnabled"
                  checked={browserEnabled}
                  onCheckedChange={setBrowserEnabled}
                />
                <div>
                  <Label htmlFor="browserEnabled" className="cursor-pointer">Browser Pixel Active</Label>
                  <p className="text-xs text-muted-foreground">Injects the Facebook Pixel script on every storefront page.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="serverEnabled"
                  checked={serverEnabled}
                  onCheckedChange={setServerEnabled}
                />
                <div>
                  <Label htmlFor="serverEnabled" className="cursor-pointer">Server-Side Events Active</Label>
                  <p className="text-xs text-muted-foreground">Sends conversion events from the server via the Conversions API.</p>
                </div>
              </div>
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
