This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Testing

Run tests with:

```bash
npm test
```

Two test files (`lib/supabase/schema.test.ts` and `lib/supabase/client.test.ts`) are **live integration tests** that run against the linked Supabase Cloud project — they are not mocked and require network access plus real credentials.

Before running `npm test`, populate `.env.test` in the project root with:

- `SUPABASE_URL` — the Project URL of the linked Supabase Cloud project (Project Settings → Data API).
- `SUPABASE_SERVICE_ROLE_KEY` — the service_role key for that project (Project Settings → API Keys). Bypasses Row Level Security, so keep this out of version control.
- `SUPABASE_DB_URL` — the Postgres connection string (Session pooler mode) for that project (Project Settings → Database → Connection string).

Without `.env.test` populated, `npm test` will fail on these two files.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
