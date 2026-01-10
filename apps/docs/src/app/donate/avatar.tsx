"use client";

import { funEmoji } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import Image from "next/image";
import { useState } from "react";

interface AvatarProps {
  avatarUrl?: string;
  name: string;
  sponsorLevel: number;
}

export function AvatarImage({ avatarUrl, name, sponsorLevel }: AvatarProps) {
  const [useAvatar, setUseAvatar] = useState(false);
  const avatarSize = sponsorLevel > 2 ? 150 : sponsorLevel > 1 ? 100 : 50;
  const avatarSvg = generateAvatar(name);

  return (
    <>
      {!useAvatar && avatarUrl ? (
        <Image
          alt={`${name}'s avatar`}
          // TODO: rounded doesn't work here for some reason
          className="aspect-square rounded-full object-cover"
          height={avatarSize}
          onError={() => {
            setUseAvatar(true);
          }}
          src={avatarUrl}
          width={avatarSize}
        />
      ) : (
        <div
          className="aspect-square rounded-full object-cover"
          dangerouslySetInnerHTML={{ __html: avatarSvg }}
          style={{ height: avatarSize, width: avatarSize }}
        />
      )}
    </>
  );
}

function generateAvatar(seed: string): string {
  const avatar = createAvatar(funEmoji, {
    mouth: ["smileTeeth", "smileLol", "wideSmile", "lilSmile"],
    seed,
  });

  return avatar.toString();
}
