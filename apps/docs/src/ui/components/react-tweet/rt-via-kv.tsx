import { kv } from "@vercel/kv";
import { EmbeddedTweet, TweetNotFound } from "react-tweet";
import { fetchTweet, type Tweet } from "react-tweet/api";

import { components } from "./rt-components";

async function getTweet(id: string, fetchOptions?: RequestInit): Promise<Tweet | undefined> {
  try {
    const { data, notFound, tombstone } = await fetchTweet(id, fetchOptions);

    if (data) {
      await kv.set(`tweet:${id}`, data);
      return data;
    }
    if (tombstone || notFound) {
      // remove the tweet from the cache if it has been made private
      // by the author (tombstone) or if this tweet no longer exists
      await kv.del(`tweet:${id}`);
    }
  } catch (error) {
    console.error("fetching the tweet failed with:", error);
  }

  const cachedTweet = await kv.get<Tweet>(`tweet:${id}`);
  return cachedTweet ?? undefined;
}

export const TweetPageViaKV = async ({ id }: { id: string }) => {
  try {
    const tweet = await getTweet(id);
    return tweet ? (
      // eslint-disable-next-line perfectionist/sort-jsx-props
      <EmbeddedTweet components={components} tweet={tweet} />
    ) : (
      <TweetNotFound />
    );
  } catch (error) {
    console.error(error);
    return <TweetNotFound error={error} />;
  }
};
