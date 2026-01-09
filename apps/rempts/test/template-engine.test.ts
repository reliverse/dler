import { expect, test } from "bun:test";
import {
  getBundledTemplatePath,
  isLocalTemplate,
  resolveTemplateSource,
} from "../src/template-engine";

test("resolveTemplateSource - handles special templates", () => {
  expect(resolveTemplateSource("basic")).toBe("github:rempts/templates/basic");
  expect(resolveTemplateSource("advanced")).toBe("github:rempts/templates/advanced");
  expect(resolveTemplateSource("monorepo")).toBe("github:rempts/templates/monorepo");
});

test("resolveTemplateSource - handles github shortcuts", () => {
  expect(resolveTemplateSource("user/repo")).toBe("github:user/repo");
  expect(resolveTemplateSource("org/repo/subdir")).toBe("github:org/repo/subdir");
});

test("resolveTemplateSource - preserves full URLs", () => {
  expect(resolveTemplateSource("github:user/repo")).toBe("github:user/repo");
  expect(resolveTemplateSource("gitlab:user/repo")).toBe("gitlab:user/repo");
  expect(resolveTemplateSource("npm:package-name")).toBe("npm:/package-name");
});

test("isLocalTemplate - detects local templates", async () => {
  expect(await isLocalTemplate("file:./template")).toBe(true);
  expect(await isLocalTemplate("./my-template")).toBe(true);
  expect(await isLocalTemplate("../templates/basic")).toBe(true);
  expect(await isLocalTemplate("github:user/repo")).toBe(false);
});

test("getBundledTemplatePath - returns correct paths", () => {
  const basicPath = getBundledTemplatePath("basic");
  expect(basicPath).toContain("templates/basic");
  expect(basicPath).toContain("rempts");
});
