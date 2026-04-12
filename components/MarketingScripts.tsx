"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Script from "next/script";

export function MarketingScripts() {
  const settings = useQuery(api.marketing.getPublicSettings);
  if (!settings) return null;

  return (
    <>
      {/* Facebook Pixel */}
      {settings.facebookBrowserEnabled && settings.facebookPixelId && (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${settings.facebookPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {/* Google Analytics 4 */}
      {settings.googleEnabled && settings.ga4MeasurementId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${settings.ga4MeasurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${settings.ga4MeasurementId}');
            `}
          </Script>
        </>
      )}

      {/* Custom Head Scripts */}
      {settings.headScripts && (
        <div
          id="custom-head-scripts"
          dangerouslySetInnerHTML={{ __html: settings.headScripts }}
        />
      )}
    </>
  );
}
