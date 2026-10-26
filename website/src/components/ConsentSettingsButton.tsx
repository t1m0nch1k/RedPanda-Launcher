"use client";

import React from "react";

/**
 * Кнопка «Параметры конфиденциальности».
 * Открывает CookieBanner повторно (после того, как решение уже сохранено).
 */
export function ConsentSettingsButton({ className }: { className?: string }) {
  const openConsentSettings = () => {
    window.dispatchEvent(new Event("redpanda-open-consent"));
  };

  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className={className ?? "inline-flex items-center gap-1.5 hover:text-foreground transition-colors text-muted cursor-pointer"}
    >
      {/* Официальный синий бейдж Privacy Options (Check & X) */}
      <svg className="w-5 h-2.5" viewBox="0 0 28 14" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="14" rx="7" fill="#0078D4" />
        <path d="M6 7L8 9L12 5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 5L22 9M22 5L18 9" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Параметры конфиденциальности</span>
    </button>
  );
}
