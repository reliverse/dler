"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "~/ui/primitives/skeleton";

import { getRandomYouTubeVideo, type YouTubeVideo } from "./youtube-ids";
import { YouTubeEmbed } from "./yt-embed";

interface RandomYouTubeProps {
  className?: string;
}

export function RandomYouTube({ className }: RandomYouTubeProps) {
  const [video, setVideo] = useState<null | YouTubeVideo>(null);

  useEffect(() => {
    setVideo(getRandomYouTubeVideo());
  }, []);

  if (!video) {
    return <Skeleton className="aspect-video w-full rounded-lg" />;
  }

  return <YouTubeEmbed className={className} video={video} />;
}
