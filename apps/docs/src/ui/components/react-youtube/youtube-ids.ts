export interface YouTubeVideo {
  id: string;
  timestamp?: string;
  title: string;
}

export const YOUTUBE_VIDEOS: YouTubeVideo[] = [
  {
    id: "c-hKSbzooAg",
    title: "[@t3dotgg] theo's biggest tutorial ever",
  },
  {
    id: "cDiB-6udBb0",
    title: "[@AnthonyVicino] f*ck hustle culture",
  },
  {
    id: "Fi4zbcRG4Ww",
    title: "[@IAmMarkManson] if you're ambitious but lazy",
  },
  {
    id: "kuFBVzjANEo",
    title: "[@whosajid] vibe coding is getting out of hand",
  },
  {
    id: "JeNS1ZNHQs8",
    title: "[@programmersarealsohuman5909] interview with vibe coder in 2025",
  },
  {
    id: "gwF9hKUCPCo",
    title: "[@DorianDevelops] 99% of self taught programmers fail because of this",
  },
];

export function formatYouTubeParams(video: YouTubeVideo): string {
  if (!video.timestamp) return "";
  return `start=${video.timestamp}`;
}

export function getRandomYouTubeVideo(): YouTubeVideo {
  return YOUTUBE_VIDEOS[Math.floor(Math.random() * YOUTUBE_VIDEOS.length)];
}
