"use client";

import type { FC } from "react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/ui/primitives/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/ui/primitives/tabs";

import { AboutTab } from "./about";
import { ContactSection } from "./contact";
import { ManifestoTab } from "./manifesto/mod";
import { ProjectsTab } from "./projects";
import { SupportTab } from "./support";

const TABS = [
  { label: "about reliverse", value: "about" },
  { label: "projects", value: "projects" },
  { label: "manifesto", value: "manifesto" },
  { label: "support", value: "support" },
] as const;

export const TabsSection: FC = () => {
  return (
    <Tabs aria-label="Reliverse information tabs" className="mb-12" defaultValue="about">
      {/* TABS LIST */}
      <TabsList
        aria-label="Select information section"
        className="tabs-list grid h-auto w-full grid-cols-4 gap-2 bg-transparent"
      >
        {TABS.map(({ label, value }) => (
          <TabsTrigger
            aria-label={`Show ${label} information`}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "brutal-button data-[state=active]:bg-foreground data-[state=active]:text-background"
            )}
            key={value}
            value={value}
          >
            {label}
          </TabsTrigger>
        ))}
      </TabsList>

      {/* ABOUT */}
      <TabsContent aria-labelledby="about-tab" className="tabs-content mt-6" value="about">
        <AboutTab />
        <ContactSection />
      </TabsContent>

      {/* PROJECTS */}
      <TabsContent aria-labelledby="projects-tab" className="tabs-content mt-6" value="projects">
        <ProjectsTab />
      </TabsContent>

      {/* SUPPORT */}
      <TabsContent aria-labelledby="support-tab" className="tabs-content mt-6" value="support">
        <SupportTab />
      </TabsContent>

      {/* MANIFESTO */}
      <TabsContent aria-labelledby="manifesto-tab" className="tabs-content mt-6" value="manifesto">
        <ManifestoTab />
      </TabsContent>
    </Tabs>
  );
};
