import { unstable_cache } from "next/cache";
import { EmbeddedTweet, TweetNotFound } from "react-tweet";
import { getTweet as _getTweet } from "react-tweet/api";

const getTweet = unstable_cache(async (id: string) => _getTweet(id), ["tweet"], {
  revalidate: 3600 * 24,
});

export const TweetPageViaCache = async ({ id }: { id: string }) => {
  try {
    const tweet = await getTweet(id);
    return (
      <div className="h-fit w-full grayscale transition-all duration-300 hover:grayscale-0">
        {tweet ? <EmbeddedTweet tweet={tweet} /> : <TweetNotFound />}
      </div>
    );
  } catch (error) {
    console.error(error);
    return <TweetNotFound error={error} />;
  }
};
