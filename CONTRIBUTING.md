# Contributing

## Set up

Use Node.js 22 and npm. Install dependencies and the supported Playwright browsers:

```sh
npm ci
npx playwright install chromium firefox webkit
```

## Check your changes

```sh
npm run build
npm test
npm run test:e2e
```

The browser tests build the production site and serve that build locally. Keep test data synthetic; never add real member lists or personal information.

## Commit messages

Use a short Conventional Commit-style summary, such as `fix: keep opt-outs out of ready lists` or `docs: explain local processing`.
