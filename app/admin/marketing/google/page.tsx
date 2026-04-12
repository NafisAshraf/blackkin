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
import { Loader2 } from "lucide-react";

interface GoogleConfig {
  ga4MeasurementId?: string;
  adsConversionId?: string;
  adsConversionLabel?: string;
  enabled?: boolean;
}

export default function GoogleSettingsPage() {
  const config = useQuery(api.marketing.getSettings, { type: "google" }) as GoogleConfig | null | undefined;
  const upsertSettings = useMutation(api.marketing.upsertSettings);

  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [adsConversionId, setAdsConversionId] = useState("");
  const [adsConversionLabel, setAdsConversionLabel] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setGa4MeasurementId(config.ga4MeasurementId ?? "");
      setAdsConversionId(config.adsConversionId ?? "");
      setAdsConversionLabel(config.adsConversionLabel ?? "");
      setEnabled(config.enabled ?? false);
    }
  }, [config]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await upsertSettings({
        type: "google",
        config: {
          ga4MeasurementId: ga4MeasurementId.trim(),
          adsConversionId: adsConversionId.trim(),
          adsConversionLabel: adsConversionLabel.trim(),
          enabled,
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
        <h1 className="text-2xl font-bold">Google Analytics & Ads</h1>
        <p className="text-muted-foreground mt-1">
          Configure Google Analytics 4 and Google Ads conversion tracking for your storefront.
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Google Settings</CardTitle>
            <CardDescription>
              Add your measurement IDs to enable analytics and conversion tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="ga4MeasurementId">GA4 Measurement ID</Label>
              <Input
                id="ga4MeasurementId"
                value={ga4MeasurementId}
                onChange={(e) => setGa4MeasurementId(e.target.value)}
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adsConversionId">Google Ads Conversion ID <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="adsConversionId"
                value={adsConversionId}
                onChange={(e) => setAdsConversionId(e.target.value)}
                placeholder="AW-XXXXXXXXXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="adsConversionLabel">Google Ads Conversion Label <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="adsConversionLabel"
                value={adsConversionLabel}
                onChange={(e) => setAdsConversionLabel(e.target.value)}
                placeholder="XXXXXXXXXXXXXXXXXXX"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="googleEnabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <div>
                <Label htmlFor="googleEnabled" className="cursor-pointer">Active</Label>
                <p className="text-xs text-muted-foreground">Injects Google Analytics and Ads tracking scripts on every storefront page.</p>
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
