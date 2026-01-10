"use client";

import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";

import type { YouTubeVideo } from "./youtube-ids";

import { formatYouTubeParams } from "./youtube-ids";

interface YouTubeEmbedProps {
  aspectHeight?: number;
  aspectWidth?: number;
  className?: string;
  cookie?: boolean;
  muted?: boolean;
  poster?: "default" | "hqdefault" | "maxresdefault" | "mqdefault" | "sddefault";
  video: YouTubeVideo;
  webp?: boolean;
}

export function YouTubeEmbed({
  aspectHeight = 9,
  aspectWidth = 16,
  className,
  cookie = false,
  muted = false,
  poster = "hqdefault",
  video,
  webp = true,
}: YouTubeEmbedProps) {
  return (
    <div
      className={`vhs-effect h-fit w-full grayscale transition-all duration-300 hover:grayscale-0 ${className || ""}`}
    >
      <LiteYouTubeEmbed
        aspectHeight={aspectHeight}
        aspectWidth={aspectWidth}
        cookie={cookie}
        id={video.id}
        muted={muted}
        params={formatYouTubeParams(video)}
        poster={poster}
        title={video.title}
        webp={webp}
        wrapperClass="yt-lite w-full rounded-lg overflow-hidden"
      />
    </div>
  );
}
