"use client";

import { CheckCircle, Globe, TrendingUp, Video } from "lucide-react";

import { cn } from "~/lib/utils";

export interface BentoItem {
  colSpan?: number;
  cta?: string;
  description: string;
  hasPersistentHover?: boolean;
  icon: React.ReactNode;
  meta?: string;
  status?: string;
  tags?: string[];
  title: string;
}

interface BentoGridProps {
  items: BentoItem[];
}

const itemsSample: BentoItem[] = [
  {
    colSpan: 2,
    description: "Real-time metrics with AI-powered insights and predictive analytics",
    hasPersistentHover: true,
    icon: <TrendingUp className="h-4 w-4 text-blue-500" />,
    meta: "v2.4.1",
    status: "Live",
    tags: ["Statistics", "Reports", "AI"],
    title: "Analytics Dashboard",
  },
  {
    description: "Automated workflow management with priority scheduling",
    icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    meta: "84 completed",
    status: "Updated",
    tags: ["Productivity", "Automation"],
    title: "Task Manager",
  },
  {
    colSpan: 2,
    description: "Cloud storage with intelligent content processing",
    icon: <Video className="h-4 w-4 text-purple-500" />,
    meta: "12GB used",
    tags: ["Storage", "CDN"],
    title: "Media Library",
  },
  {
    description: "Multi-region deployment with edge computing",
    icon: <Globe className="h-4 w-4 text-sky-500" />,
    meta: "6 regions",
    status: "Beta",
    tags: ["Infrastructure", "Edge"],
    title: "Global Network",
  },
];

function BentoGrid({ items = itemsSample }: BentoGridProps) {
  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-3 p-4 md:grid-cols-3">
      {items.map((item) => (
        <div
          className={cn(
            "group relative overflow-hidden rounded-xl p-4 transition-all duration-300",
            "border border-gray-100/80 bg-white dark:border-white/10 dark:bg-black",
            "hover:shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:hover:shadow-[0_2px_12px_rgba(255,255,255,0.03)]",
            "will-change-transform hover:-translate-y-0.5",
            item.colSpan || "col-span-1",
            item.colSpan === 2 ? "md:col-span-2" : "",
            {
              "dark:shadow-[0_2px_12px_rgba(255,255,255,0.03)]": item.hasPersistentHover,
              "-translate-y-0.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]": item.hasPersistentHover,
            }
          )}
          key={item.title}
        >
          <div
            className={`absolute inset-0 ${
              item.hasPersistentHover ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          >
            <div className="absolute inset-0 bg-[length:4px_4px] bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)]" />
          </div>

          <div className="relative flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/5 transition-all duration-300 group-hover:bg-gradient-to-br dark:bg-white/10">
                {item.icon}
              </div>
              <span
                className={cn(
                  "rounded-lg px-2 py-1 font-medium text-xs backdrop-blur-sm",
                  "bg-black/5 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                  "transition-colors duration-300 group-hover:bg-black/10 dark:group-hover:bg-white/20"
                )}
              >
                {item.status || "Active"}
              </span>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium text-[15px] text-gray-900 tracking-tight dark:text-gray-100">
                {item.title}
                <span className="ml-2 font-normal text-gray-500 text-xs dark:text-gray-400">
                  {item.meta}
                </span>
              </h3>
              <p className="font-[425] text-gray-600 text-sm leading-snug dark:text-gray-300">
                {item.description}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-500 text-xs dark:text-gray-400">
                {item.tags?.map((tag, i) => (
                  <span
                    className="rounded-md bg-black/5 px-2 py-1 backdrop-blur-sm transition-all duration-200 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20"
                    key={i}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="text-gray-500 text-xs opacity-0 transition-opacity group-hover:opacity-100 dark:text-gray-400">
                {item.cta || "Explore →"}
              </span>
            </div>
          </div>

          <div
            className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-transparent via-gray-100/50 to-transparent p-px dark:via-white/10 ${
              item.hasPersistentHover ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            } transition-opacity duration-300`}
          />
        </div>
      ))}
    </div>
  );
}

export { BentoGrid };
