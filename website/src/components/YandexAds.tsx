"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

function readAdsConsent(): boolean {
  try {
    const raw = localStorage.getItem("redpanda_cookie_consent");
    if (!raw) return false;
    return Boolean(JSON.parse(raw).ads);
  } catch {
    return false;
  }
}

export function YandexAds() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(readAdsConsent());
    sync();
    window.addEventListener("redpanda-consent-changed", sync);
    return () => window.removeEventListener("redpanda-consent-changed", sync);
  }, []);

  if (!enabled) return null;
  return (
    <>
      <Script src="https://yandex.ru/ads/system/context.js" strategy="afterInteractive" />
      <Script src="https://yandex.ru/ads/system/ap-loader.js" strategy="afterInteractive" data-page-id="19834583" />
    </>
  );
}
