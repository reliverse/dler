import { Suspense } from "react";
import { TweetSkeleton } from "react-tweet";

import NoiseEffect from "~/ui/components/noise-effect";
import { TweetPageViaCache } from "~/ui/components/react-tweet/rt-via-cache";
import { TWEET_IDS } from "~/ui/components/react-tweet/tweet-ids";
import { YouTubeEmbed } from "~/ui/components/react-youtube";
import { YOUTUBE_VIDEOS, type YouTubeVideo } from "~/ui/components/react-youtube/youtube-ids";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/ui/primitives/tabs";

export default function GemsPage() {
  return (
    <main className="relative min-h-screen bg-background font-mono text-foreground">
      <NoiseEffect />
      <div className="scanlines" />
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <h1 className="mb-8 font-bold text-3xl">Gems Collection</h1>

        <Tabs className="w-full" defaultValue="tweets">
          <TabsList className="mb-8">
            <TabsTrigger value="tweets">Tweets</TabsTrigger>
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
          </TabsList>

          <TabsContent value="tweets">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {TWEET_IDS.map((tweetId: string) => (
                <div className="h-fit" key={tweetId}>
                  <Suspense fallback={<TweetSkeleton />}>
                    <TweetPageViaCache id={tweetId} />
                  </Suspense>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="youtube">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              {YOUTUBE_VIDEOS.map((video: YouTubeVideo) => (
                <div className="h-fit" key={video.id}>
                  <h3 className="mb-2 font-semibold text-lg">{video.title}</h3>
                  <YouTubeEmbed className="w-full" video={video} />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
