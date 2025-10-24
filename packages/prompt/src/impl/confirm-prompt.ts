import { askQuestion } from "./question-prompt";

export const confirmPrompt = async (
  question: string,
  defaultYes = true,
): Promise<boolean> => {
  const defaultLabel = defaultYes ? "Y/n" : "y/N";
  const value = await askQuestion(question, defaultLabel);
  const normalized = value.trim().toLowerCase();

  if (normalized === "y" || normalized === "yes") return true;
  if (normalized === "n" || normalized === "no") return false;

  // Hitting enter returns the default label; in that case, honor defaultYes
  return defaultYes;
};
