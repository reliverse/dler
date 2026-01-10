import {
  Code2,
  Database,
  DollarSign,
  Folder,
  Globe,
  Heart,
  Medal,
  Package,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/ui/primitives/accordion";
import { BentoGrid, type BentoItem } from "~/ui/primitives/bento-grid";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";
import { Heading } from "~/ui/primitives/heading";
import { Link } from "~/ui/primitives/link";
import { Main } from "~/ui/primitives/main";
import { Section } from "~/ui/primitives/section";

import { Sponsors } from "./sponsors";

interface DonationMethod {
  content?: ReactNode;
  description: string;
  linkHref: string;
  linkText: string;
  title: string;
}

const DONATION_METHODS: DonationMethod[] = [
  {
    description: "Support us on Patreon.",
    linkHref: "https://patreon.com/blefnk",
    linkText: "Donate via Patreon",
    title: "Patreon",
  },
  {
    description: "Advanced features and reporting.",
    linkHref: "https://github.com/sponsors/blefnk",
    linkText: "Donate via GitHub Sponsors",
    title: "GitHub Sponsors",
  },
  {
    description: "blefony.nazkorn@gmail.com",
    linkHref: "https://paypal.me/blefony",
    linkText: "Donate via PayPal",
    title: "PayPal",
  },
];

const TIERS = ["Platinum Sponsor", "Gold Sponsor", "Silver Sponsor", "Bronze Sponsor"];

const USAGE_ITEMS = [
  "Team Development",
  "Contributor Pool",
  "Dependencies",
  "Community Projects",
  "Support Systems",
  "Marketing",
  "Research",
  "Legal Related",
  "Miscellaneous",
];

interface FAQ {
  answer: string;
  question: string;
}

const FAQS: FAQ[] = [
  {
    answer:
      "Yep. If you use a platform that sends receipts, you'll get one by email. If it doesn't show up within 24 hours, just ping me.",
    question: "Do I get a receipt for my donation?",
  },
  {
    answer: "I do. I look at where it's needed most and make sure it's going to the right places.",
    question: "Who decides where the money goes?",
  },
  {
    answer: "Absolutely. If you want to check the numbers, just ask and I'll share the reports.",
    question: "Can I see how the money's being spent?",
  },
  {
    answer: "For sure. You can cancel anytime through the platform you used — no hard feelings.",
    question: "Can I cancel my donation?",
  },
  {
    answer: "I refresh things daily, so it should pop up within 24 hours.",
    question: "How long until my logo or avatar shows up?",
  },
  {
    answer: "Definitely. Just let me know what you want changed or updated.",
    question: "Can I change my logo, avatar, or URL?",
  },
  {
    answer: "Yep. Tell me what to tweak and I'll take care of it.",
    question: "Can I remove or edit my logo/avatar or other details?",
  },
  {
    answer: "Yes. Platforms like PayPal or Ko-Fi let you do that without showing your name.",
    question: "Can I donate anonymously?",
  },
  {
    answer: "Most platforms support other currencies. Just check what your platform allows.",
    question: "Can I donate in a currency other than USD?",
  },
  {
    answer:
      "Of course. PayPal, Ko-Fi, Stripe, GitHub Sponsors — they all support one-time donations.",
    question: "Can I make a one-time donation?",
  },
];

export default function DonatePage() {
  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <Link className="brutal-button px-4 py-2" href="/">
          &larr; back
        </Link>
      </header>
      <Main className="space-y-16">
        <PageDescription />
        <WaysToDonate />
        <DonateCards />
        <Sponsors />
        <DonationTiers />
        <UsageDetails />
        <Questions />
        <GetStarted />
      </Main>
    </>
  );
}

function DonateCard({ content = null, description, linkHref, linkText, title }: DonationMethod) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      {content && <CardContent>{content}</CardContent>}

      <CardFooter>
        <Link href={linkHref} rel="noopener noreferrer" target="_blank">
          {linkText}
        </Link>
      </CardFooter>
    </Card>
  );
}

function DonateCards() {
  return (
    <Section>
      <Heading>Donation Platforms</Heading>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DONATION_METHODS.map((m) => (
          <DonateCard key={m.title} {...m} />
        ))}
      </div>
    </Section>
  );
}

function DonationTiers() {
  const tierItems: BentoItem[] = TIERS.map((title, idx) => ({
    description: "Perks, shoutouts & warm fuzzy feelings",
    icon: <Medal className="h-4 w-4 text-amber-500" />,
    meta: "",
    status: idx === 0 ? "Top" : "Tier",
    tags: ["Support"],
    title,
  }));

  return (
    <Section className="space-y-6">
      <Heading>Donation Tiers</Heading>
      <Heading as="h3">
        I'm still figuring out the exact perks. Honestly, you might get more than you see listed
        here — I love overdelivering.
      </Heading>
      <Heading as="h3">
        Any support means the world. But yeah, higher tiers unlock a few extras.
      </Heading>

      <BentoGrid items={tierItems} />
    </Section>
  );
}

function GetStarted() {
  return (
    <Section className="space-y-4">
      <Heading>Ready to launch your platform?</Heading>

      <Link href="https://reliverse.org/relivator" variant="default">
        Install Relivator
      </Link>

      <Link href="https://github.com/blefnk/relivator#sponsors" variant="secondary">
        Support me on GitHub
      </Link>
    </Section>
  );
}

function PageDescription() {
  return (
    <Section className="space-y-6">
      <Heading as="h1" className="font-bold text-3xl">
        Support @blefnk's Work
      </Heading>

      <Heading as="h3">
        Building something this ambitious takes time — and I'm doing most of it solo right now.
        Every donation helps me move faster, bring in collaborators, and keep the momentum going.
      </Heading>

      <Link href="/donate#sponsors">Meet the folks backing the dream</Link>
    </Section>
  );
}

function Questions() {
  return (
    <Section>
      <Heading>Questions? I've got answers.</Heading>

      <Accordion className="mt-6 w-full" collapsible type="single">
        {FAQS.map((faq) => (
          <AccordionItem key={faq.question} value={faq.question}>
            <AccordionTrigger>{faq.question}</AccordionTrigger>
            <AccordionContent>{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

function UsageDetails() {
  const usageIcons = [
    <Users className="h-4 w-4 text-sky-500" key="Team Development" />,
    <Heart className="h-4 w-4 text-rose-500" key="Contributor Pool" />,
    <Package className="h-4 w-4 text-purple-500" key="Dependencies" />,
    <Code2 className="h-4 w-4 text-cyan-500" key="Community Projects" />,
    <Settings className="h-4 w-4 text-amber-500" key="Support Systems" />,
    <DollarSign className="h-4 w-4 text-green-500" key="Marketing" />,
    <Database className="h-4 w-4 text-indigo-500" key="Research" />,
    <Shield className="h-4 w-4 text-red-500" key="Legal Related" />,
    <Folder className="h-4 w-4 text-gray-500" key="Miscellaneous" />,
  ];

  const usageItems: BentoItem[] = USAGE_ITEMS.map((title, i) => ({
    description: "Where the money goes",
    icon: usageIcons[i] || <Globe className="h-4 w-4" />,
    key: title,
    meta: "",
    tags: ["Budget"],
    title,
  }));

  return (
    <Section className="space-y-6">
      <Heading>Where the Money Goes</Heading>
      <Heading as="h3">
        I don't just stash it away. Every dollar gets invested back into the project — from dev work
        to community tools to infrastructure. Here's the breakdown:
      </Heading>

      <BentoGrid items={usageItems} />
    </Section>
  );
}

function WaysToDonate() {
  return (
    <Section className="space-y-4">
      <Heading>Ways to Support</Heading>
      <Heading as="h3">
        You can donate through any of the platforms below. Got another method in mind? I'm all ears.
      </Heading>
    </Section>
  );
}
