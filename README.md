# Exulan website

Source code for the personal website of Exulan. Based on the MIT-licensed [rafa-br34.dev](https://github.com/rafa-br34/rafa-br34.dev); see `LICENSE`.

## Table of contents

- [Personal website](#personal-website)
  - [Table of contents](#table-of-contents)
  - [Tech stack](#tech-stack)
  - [Building the website](#building-the-website)
  - [Deployment](#deployment)

## Tech stack

- [TypeScript](https://www.typescriptlang.org/)
- [Nextjs](https://nextjs.org/)
- [React](https://react.dev/)
- [Tailwind](https://tailwindcss.com/)
- [Shiki](https://shiki.style)
- ... and more (check `package.json`)

## Building the website

Install the necessary development dependencies with:

```bash
npm install --include=dev # or npm ci
```

Then, you can build the website by running:

```bash
npm run build
```

Or for development:

```bash
npm run dev
```

This will create a `dist` folder with the built files. You can then serve this folder with any static file server.

## Deployment

GitHub Pages was abandoned because of its ~500 MB artifact limit.  
Cloudflare Pages has no total-size cap (20k files 25MiB each).  
Plus Cloudflare Pages is wayyy faster in terms of bandwidth, so why not?  

`next dev --webpack` writes its cache into `dist/dev/` because `distDir` is `"dist"`. If you deploy without a clean build, that cache (single files >100 MB) gets uploaded and fails.
