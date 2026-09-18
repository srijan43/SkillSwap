# SkillSwap

SkillSwap is a cash-only creator marketplace where young talent ships work and gets paid. It's built with a modern static HTML/Tailwind frontend and a Node.js + Express + Prisma backend.

## Preview

![Landing Page](assets/landing.png)
*SkillSwap Marketplace*

![Post a Gig](assets/post-gig.png)
*Publish a Skill Offering*

![Dashboard](assets/dashboard.png)
*Creator Dashboard*

![Bookings](assets/bookings.png)
*Live Escrow & Bookings*

## Architecture

- **Frontend:** Static HTML, Vanilla JS, Tailwind CSS. Hydrates dynamic content via pi-client.js.
- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL.

## Getting Started

### Backend
\\\ash
cd backend
npm install
npm run dev
\\\

### Frontend
\\\ash
npx serve -p 3000 frontend
\\\

## Deployment
- **Frontend & Backend** can both be deployed on [Render.com](https://render.com) using the included \ender.yaml\ blueprint.
- Requires a PostgreSQL database (e.g., Neon or Supabase).

## Decisions
See [DECISIONS.md](DECISIONS.md) for a living record of architectural choices.
