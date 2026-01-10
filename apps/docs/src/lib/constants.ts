import { Github, Mail, Music, Twitter } from "lucide-react";

export const SOCIAL_LINKS = [
  { href: "https://github.com/blefnk", icon: Github, label: "GitHub profile" },
  { href: "https://x.com/blefnk", icon: Twitter, label: "Twitter profile" },
  { href: "mailto:blefnk@gmail.com", icon: Mail, label: "Email Nazar" },
  {
    href: "https://music.youtube.com/playlist?list=PLmA6aoeghea5hxj9aUR30ULe4O06b011O&si=B9QJjW4VdUGPETMX",
    icon: Music,
    label: "Music playlist",
  },
] as const;
