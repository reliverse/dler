export const gitignoreTemplate = `*.log
.env
.DS_Store
.eslintcache
node_modules
dist-jsr
dist-libs
dist-npm
`;

export const readmeTemplate = `# 🚀 Project Name

Welcome! This project was bootstrapped with [@reliverse/reinit](https://www.npmjs.com/package/@reliverse/reinit).  
It's already got the basics — now it's your turn to make it awesome ✨

## 🔧 Tech Stack

- ⚙️ Framework: _<Add your framework here>_
- 🛠️ Tools: _<Add your tooling, CLIs, etc>_
- 🧪 Tests: _<Vitest, Jest, or something else?>_
- 🧠 Linting: _ESLint, Biome, etc_
- 🌐 Deployment: _<Vercel, Netlify, Railway?>_

## 🚀 Getting Started

Clone the repo and install dependencies:

'''bash
bun install
bun dev
'''

Or if you're using another package manager:

'''bash
npm install && npm run dev
# or
pnpm i && pnpm dev
'''

## 🗂️ Project Structure

'''bash
src/
├── components/
├── pages/
├── lib/
└── styles/
'''

Feel free to tweak the structure to your liking.

## 🧩 Customize it

This project is just a starting point. You can add:

- 🧙‍♂️ Your own components and UI
- 📦 APIs, auth, i18n, analytics, whatever you need
- 🤖 AI integrations using [Reliverse CLI](https://www.npmjs.com/package/@reliverse/rse)

## 🫶 Credits

Made with ❤️ using [@reliverse/reinit](https://reliverse.org)  
Need help? [Join the Discord](https://discord.gg/Pb8uKbwpsJ)

## 📄 License

MIT © YourNameHere
`;

export const licenseTemplate = `# MIT License

Copyright (c) Nazar Kornienko (blefnk), Reliverse

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
