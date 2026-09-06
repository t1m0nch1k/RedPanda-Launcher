"use client";

import React, { useState, useEffect } from "react";
import { IconArrowUp } from "@tabler/icons-react";

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollTop;
      setVisible(totalScroll > 300);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Прокрутить страницу наверх"
      className="fixed bottom-6 right-6 z-40 p-3 bg-card border border-primary/60 text-primary hover:bg-primary hover:text-black transition-all brutalist-shadow-orange cursor-pointer group flex items-center justify-center"
      title="Наверх"
    >
      <IconArrowUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
