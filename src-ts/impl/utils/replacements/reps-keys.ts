export interface Hardcoded {
  RelivatorTitle: "Relivator template is the foundation of your eCommerce platform: Build More Efficient, Engaging, and Profitable Online Stores";
  RelivatorShort: "Relivator";
  RelivatorLower: "relivator";
  RelivatorDomain: "relivator.com";
  DefaultAuthor: "blefnk";
  DefaultEmail: "onboarding@resend.dev";
  GeneralTemplate: "template";
}

export interface UrlPatterns {
  githubUrl: (author: string, repo: string) => string;
  vercelUrl: (project: string) => string;
  packageName: (name: string) => string;
}

export const HardcodedStrings: Hardcoded = {
  RelivatorTitle:
    "Relivator template is the foundation of your eCommerce platform: Build More Efficient, Engaging, and Profitable Online Stores",
  RelivatorShort: "Relivator",
  RelivatorLower: "relivator",
  RelivatorDomain: "relivator.com",
  DefaultAuthor: "blefnk",
  DefaultEmail: "onboarding@resend.dev",
  GeneralTemplate: "template",
} as const;

export const CommonPatterns: UrlPatterns = {
  githubUrl: (author: string, repo: string) => `https://github.com/${author}/${repo}`,
  vercelUrl: (project: string) => `${project}.vercel.app`,
  packageName: (name: string) => `@${name}/app`,
} as const;
