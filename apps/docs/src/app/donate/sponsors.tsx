import { Card } from "fumadocs-ui/components/card";

import { Heading } from "~/ui/primitives/heading";
import { Link } from "~/ui/primitives/link";
import { Section } from "~/ui/primitives/section";

import { AvatarImage } from "./avatar";

interface SocialMediaLink {
  id?: string;
  platform: SocialMediaPlatform;
  username: string;
}

type SocialMediaPlatform = "Discord" | "Facebook" | "GitHub" | "Twitter" | "YouTube";

interface SponsorProps {
  avatarUrl: string;
  company: string;
  location: string;
  name: string;
  socialMedia: SocialMediaLink[];
  sponsor: string;
  sponsorLevel: number;
  title: string;
}

export function Sponsors() {
  const sponsors: SponsorProps[] = [
    {
      avatarUrl: "",
      company: "MF Piano",
      location: "Lviv, Ukraine",
      name: "Petro Melnyk",
      socialMedia: [{ platform: "YouTube", username: "mfpiano" }],
      sponsor:
        "It just works. Although Relivator is primarily a multi-vendor online store template, I asked @blefnk to make some changes for me, and he helped me out. Relivator turned out to be perfect for selling my sheet music! It's a really cool template. Thank you!",
      sponsorLevel: 3,
      title: "Music Composer & Piano Teacher",
    },
    {
      avatarUrl: "",
      company: "",
      location: "",
      name: "Daniel Humphreys",
      socialMedia: [
        { platform: "GitHub", username: "devmarauda" },
        {
          id: "1133132863655649280",
          platform: "Discord",
          username: "kongkong86",
        },
      ],
      sponsor:
        "Just found Relivator repo today by chance. Amazing work, mate. I would love to send you some $ to sponsor you and the project. Just from what I have seen so far, there has been a huge amount of work put into this 🤯. Thanks for sharing such an insane product with the community! 🦾 I can see how much work you have put into this project. It is actually insane that one person created this. Much respect to you, bro. I appreciate people like you who share their knowledge and talent with others and ask nothing in return ❤️. Unfortunately, many people in this world don't respect the amount of effort and dedication it takes, and they are only interested in how they can benefit from others' work.",
      sponsorLevel: 2,
      title: "Web Developer",
    },
    {
      avatarUrl: "",
      company: "",
      location: "Brisbane, Australia",
      name: "Simon Victory",
      socialMedia: [
        { platform: "GitHub", username: "svict4" },
        {
          id: "142160962684715008",
          platform: "Discord",
          username: "svict4",
        },
      ],
      sponsor:
        "Great work with Relivator and getting everything done for 1.2.6! I've been referencing how you've stitched together some tools and deeply appreciate the work you've done so far. Please accept this donation as a token of my appreciation. You've got a lot of repositories and content to manage, so remember to stay focused and not stretch yourself too much!",
      sponsorLevel: 2,
      title: "GovTech and CivicTech Developer",
    },
    {
      avatarUrl: "",
      company: "",
      location: "Oman",
      name: "Saif Al-Hashar",
      socialMedia: [
        { platform: "GitHub", username: "Saif-V" },
        {
          id: "1103781640821538896",
          platform: "Discord",
          username: "Gh0st",
        },
      ],
      sponsor:
        "Enjoy your two boosts for your server from me. The early access looks pretty good. Oh god, this project is just amazing, and I appreciate everything! I want to do everything I can to support your work. This is how I can support and contribute to this project the best I can :3",
      sponsorLevel: 1,
      title: "Web Developer",
    },
    {
      avatarUrl: "",
      company: "fleura.de",
      location: "Germany",
      name: "Özkan Demir",
      socialMedia: [
        { platform: "GitHub", username: "demiroo" },
        {
          id: "605798991619293195",
          platform: "Discord",
          username: "demiroezkan",
        },
      ],
      sponsor:
        "I learned a lot from using the Relivator project! I see the hard work that was put into it. It's truly an amazing open-source starter; I have built my startup using it. @blefnk, your hard work is impressive; it's astonishing how you manage it all alone.",
      sponsorLevel: 1,
      title: "Web Developer",
    },
  ];

  return (
    <Section id="sponsors">
      <Heading className="mb-4 font-bold text-2xl">Sponsors & Discord Boosters</Heading>
      <p className="text-muted-foreground">humans supporting humans</p>
      <div className="mb-8 space-y-4 text-lg text-muted-foreground">
        <p>
          these aren't just sponsors. they're believers in a more human js ecosystem.
          <br />
          people who give a damn about making tools feel alive.
        </p>
        <p className="text-sm opacity-80">
          larger avatars = higher support level, but every bit of support means the world.
        </p>
      </div>
      <div className="space-y-6 text-sm">
        {sponsors.map((t) => (
          <Sponsor key={t.name} {...t} />
        ))}
      </div>
    </Section>
  );
}

function Sponsor({
  avatarUrl,
  company,
  location,
  name,
  socialMedia,
  sponsor,
  sponsorLevel,
  title,
}: SponsorProps) {
  const socialMediaLinks: Record<SocialMediaPlatform, (link: SocialMediaLink) => string> = {
    Discord: (link: SocialMediaLink) =>
      link.id
        ? `https://discordapp.com/users/${link.id}`
        : `https://discordapp.com/users/${link.username}`,
    Facebook: (link: SocialMediaLink) => `https://facebook.com/${link.username}`,
    GitHub: (link: SocialMediaLink) => `https://github.com/${link.username}`,
    Twitter: (link: SocialMediaLink) => `https://twitter.com/${link.username}`,
    YouTube: (link: SocialMediaLink) => `https://youtube.com/@${link.username}`,
  };

  return (
    <Card className="flex rounded-lg bg-chart-1/30 p-6 shadow-md" title={sponsor}>
      <div className="flex-none">
        <AvatarImage avatarUrl={avatarUrl} name={name} sponsorLevel={sponsorLevel} />
      </div>
      <div className="ml-4 grow text-sm">
        <Heading className="text-sm">
          © {name}, {title}
          {company && `, ${company}`}
          {location && <span className="opacity-80">&nbsp;({location})</span>}
          <br />
          {socialMedia && socialMedia.length > 0 && (
            <span>
              {socialMedia.map(({ id, platform, username }, index) => (
                <span key={index}>
                  <Link
                    className={`opacity-80 hover:underline`}
                    href={socialMediaLinks[platform]({
                      id,
                      platform,
                      username,
                    })}
                    rel="noopener noreferrer"
                    target="_blank"
                    variant="link"
                  >
                    {platform}: {username}
                  </Link>
                  {index < socialMedia.length - 1 && " - "}
                </span>
              ))}
            </span>
          )}
        </Heading>
      </div>
    </Card>
  );
}
