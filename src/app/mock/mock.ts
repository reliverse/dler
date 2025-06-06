import type { PackageJson, TSConfig } from "pkg-types";

import type { Template } from "~/libs/sdk/sdk-impl/utils/pack-unpack/pu-types";

export const BASIC_DLER_TEMPLATE: Template = {
  name: "basic",
  description: "Template generated from 7 files",
  config: {
    files: {
      "src/templates/basic/README.md": {
        content: "# Mock Project\n\nThis is a mock project created for testing purposes.",
        type: "text",
      },
      "src/templates/basic/package.json": {
        jsonComments: {
          10: "This is a comment\nThis is a comment on a new line",
          20: "This is another comment",
          30: "/**\nThis is a content of block comment\nThis is another line of block comment",
        },
        content: {
          name: "mock-project",
          version: "1.0.0",
          dependencies: {
            "@reliverse/relifso": "^latest",
            "@reliverse/relinka": "^latest",
          },
        } satisfies PackageJson,
        type: "json",
      },
      "src/templates/basic/tsconfig.json": {
        content: {
          extends: "@reliverse/relinka/tsconfig.json",
        } satisfies TSConfig,
        type: "json",
      },
      "src/templates/basic/index.ts": {
        content: "export const mock = () => console.log('Hello from mock!');",
        type: "text",
      },
      "src/templates/basic/utils/helper.ts": {
        content: "export const helper = () => 'Helper function';",
        type: "text",
      },
      // binary type (mp4)
      "src/templates/basic/video.mp4": {
        content: "",
        type: "binary",
        binaryHash: "...",
      },
      // hasError: true
      "src/templates/basic/file-with-unhandled-dler-templates-issue.ts": {
        content: "",
        type: "text",
        hasError: true,
      },
    },
  },
};

export const API_DLER_TEMPLATE: Template = {
  name: "api",
  description: "Template generated from 3 files",
  config: {
    files: {
      "src/templates/api/README.md": {
        content: "# Mock Project\n\nThis is a mock project created for testing purposes.\n",
        type: "text",
      },
      "src/templates/api/index.ts": {
        content:
          '// @ts-expect-error this is a mock file\nimport express from "express";\n\nconst app = express();\napp.listen(3000);\n',
        type: "text",
      },
      "src/templates/api/routes/index.ts": {
        content:
          '// @ts-expect-error this is a mock file\nimport { Router } from "express";\n\nexport const router = Router();\n',
        type: "text",
      },
    },
  },
};

export const REACT_DLER_TEMPLATE: Template = {
  name: "react",
  description: "Template generated from 7 files",
  config: {
    files: {
      "src/templates/react/App.css": {
        content:
          "#root {\n  max-width: 1280px;\n  margin: 0 auto;\n  padding: 2rem;\n  text-align: center;\n}\n\n.card {\n  padding: 2em;\n}\n\nbutton {\n  border-radius: 8px;\n  border: 1px solid transparent;\n  padding: 0.6em 1.2em;\n  font-size: 1em;\n  font-weight: 500;\n  font-family: inherit;\n  background-color: #1a1a1a;\n  cursor: pointer;\n  transition: border-color 0.25s;\n}\n\nbutton:hover {\n  border-color: #646cff;\n}\n\nbutton:focus,\nbutton:focus-visible {\n  outline: 4px auto -webkit-focus-ring-color;\n}",
        type: "text",
      },
      "src/templates/react/App.tsx": {
        content:
          'import { useState } from "react";\nimport "./App.css";\n\nfunction App() {\n  const [count, setCount] = useState(0);\n\n  return (\n    // @ts-expect-error mock\n    <div className="App">\n      {/* @ts-expect-error mock */}\n      <h1>React TSX App</h1>\n      {/* @ts-expect-error mock */}\n      <div className="card">\n        {/* @ts-expect-error mock */}\n        <button onClick={() => setCount((count: number) => count + 1)}>count is {count}</button>\n      </div>\n    </div>\n  );\n}\n\nexport default App;\n',
        type: "text",
      },
      "src/templates/react/DOCS.md": {
        content:
          "# React TSX Project\n\nA modern React project with TypeScript and Vite.\n\n## Features\n\n- React 19 with TypeScript\n- Vite for fast development and building\n- Modern CSS with CSS modules support\n- Hot Module Replacement (HMR)\n- ESLint and Prettier configuration\n\n## Getting Started\n\n1. Install dependencies:\n\n   ```bash\n   npm install\n   ```\n\n2. Start development server:\n\n   ```bash\n   npm run dev\n   ```\n\n3. Build for production:\n\n   ```bash\n   npm run build\n   ```\n",
        type: "text",
      },
      "src/templates/react/globals.css": {
        content:
          ":root {\n  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;\n  line-height: 1.5;\n  font-weight: 400;\n\n  color-scheme: light dark;\n  color: rgba(255, 255, 255, 0.87);\n  background-color: #242424;\n\n  font-synthesis: none;\n  text-rendering: optimizeLegibility;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n}\n\nbody {\n  margin: 0;\n  display: flex;\n  place-items: center;\n  min-width: 320px;\n  min-height: 100vh;\n}\n\nh1 {\n  font-size: 3.2em;\n  line-height: 1.1;\n}",
        type: "text",
      },
      "src/templates/react/hello/world.ts": {
        content: 'console.log("Hello, world!");\r\n',
        type: "text",
      },
      "src/templates/react/index.html": {
        content:
          '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>React TSX App</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.tsx"></script>\n  </body>\n</html>',
        type: "text",
      },
      "src/templates/react/main.tsx": {
        content:
          'import React from "react";\n// @ts-expect-error mock\nimport ReactDOM from "react-dom/client";\nimport App from "./App";\nimport "./index.css";\n\nReactDOM.createRoot(document.getElementById("root")!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n);\n',
        type: "text",
      },
    },
  },
};

export const DLER_TEMPLATES = {
  basic: BASIC_DLER_TEMPLATE,
  api: API_DLER_TEMPLATE,
  react: REACT_DLER_TEMPLATE,
} as const;

export type DLER_TEMPLATE_NAMES = keyof typeof DLER_TEMPLATES;

export const dlerTemplatesMap: Record<string, DLER_TEMPLATE_NAMES> = {
  BASIC_DLER_TEMPLATE: "basic",
  API_DLER_TEMPLATE: "api",
  REACT_DLER_TEMPLATE: "react",
};
