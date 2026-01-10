import { Card } from "fumadocs-ui/components/card";

import Link from "next/link";
import type { FC } from "react";
import { Button } from "~/ui/primitives/button";
import { projects } from "~/utils/ts-to-md/projects";

import ProjectCard from "../../project-card";

export const ProjectsTab: FC = () => (
  <Card className="brutal-card p-6" title="featured projects">
    <h3 className="mb-6 font-bold text-2xl">reliverse projects</h3>
    <p className="mb-6 text-lg">
      these are not just repos. they're experiments in making code feel alive, loyal, and on your
      side. every project is a step toward a better, weirder, more human js ecosystem.
    </p>
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {projects.map((project) => (
        <Link href={`/projects/${project.id}`} key={project.id}>
          <ProjectCard {...project} isInternal link={`/projects/${project.id}`} />
        </Link>
      ))}
    </div>
    <div className="mt-8">
      <h4 className="mb-4 font-bold text-xl">explore more</h4>
      <div className="flex gap-4">
        <Link
          href="https://github.com/orgs/reliverse/repositories"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Button className="brutal-button">reliverse repos</Button>
        </Link>
        <Link
          href="https://github.com/blefnk?tab=repositories"
          rel="noopener noreferrer"
          target="_blank"
        >
          <Button className="brutal-button" variant="outline">
            blefnk's personal repos
          </Button>
        </Link>
      </div>
    </div>
  </Card>
);
