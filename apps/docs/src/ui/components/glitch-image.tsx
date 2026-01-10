"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface GlitchImageProps {
  alt: string;
  className?: string;
  height: number;
  src: string;
  width: number;
}

export default function GlitchImage({ alt, className, height, src, width }: GlitchImageProps) {
  const [glitchActive, setGlitchActive] = useState(false);

  useEffect(() => {
    // Randomly trigger glitch effect
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 200);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <Image
        alt={alt}
        className={`${className} ${glitchActive ? "opacity-90" : "opacity-100"}`}
        height={height}
        src={src || "/placeholder.svg"}
        style={
          glitchActive
            ? {
                filter: "hue-rotate(180deg) brightness(0.9)",
                transform: `translate(${Math.random() * 10 - 5}px, ${Math.random() * 10 - 5}px)`,
              }
            : {}
        }
        width={width}
      />

      {glitchActive && (
        <Image
          alt=""
          className={`absolute top-0 left-0 ${className}`}
          height={height}
          src={src || "/placeholder.svg"}
          style={{
            filter: "hue-rotate(180deg) blur(1px) brightness(0.9)",
            mixBlendMode: "difference",
            opacity: 0.5,
            transform: `translate(${Math.random() * 15 - 7.5}px, ${Math.random() * 15 - 7.5}px)`,
          }}
          width={width}
        />
      )}
    </div>
  );
}
