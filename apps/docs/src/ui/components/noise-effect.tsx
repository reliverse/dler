"use client";

import { useEffect, useRef } from "react";

/**
 * Adds a subtle CRT-style flicker by toggling the opacity of the `.noise` layer.
 * Automatically disabled for users that prefer reduced motion.
 */
export default function NoiseEffect() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const element = ref.current;
    const toggle = () => {
      element.style.opacity = Math.random() > 0.05 ? "0.05" : "0";
    };

    const interval = setInterval(toggle, 2000);
    return () => clearInterval(interval);
  }, []);

  return <div aria-hidden="true" className="noise" ref={ref} />;
}
