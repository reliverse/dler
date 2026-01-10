import type { FC, ReactNode } from "react";

interface ManifestoSectionProps {
  children: ReactNode;
  emoji: string;
  title: string;
}
export const ManifestoSection: FC<ManifestoSectionProps> = ({ children, emoji, title }) => (
  <section>
    <h4 className="mb-2 flex items-center gap-2 font-bold text-xl">
      <span aria-hidden="true">{emoji}</span>
      <span>{title}</span>
    </h4>
    {children}
  </section>
);
