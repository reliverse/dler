import fs from "@reliverse/relifso";

/**
 * Checks if the first line of a file contains the disable aggregation comment
 */
// @ts-expect-error TODO: SOMETHING STRANGE WITH THIS FUNCTION
// FOR SOME REASON MKDIST DON'T WANT TO REMOVE TS ANNOTATIONS
// FROM THIS AND ALL FUNCTIONS WHICH LIVE IN THE SAME FILE
export async function isAggregationDisabled(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const firstLine = content.split("\n")[0]?.trim();
    return firstLine === "// <dler-disable-agg>";
  } catch {
    return false;
  }
}
