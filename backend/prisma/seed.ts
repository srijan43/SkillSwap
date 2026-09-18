/**
 * SkillSwap demo seed.
 *
 * Idempotent: safe to re-run; every insert is upserted by a stable key so
 * `npm run seed` twice does not create duplicates.
 *
 * Persona choices match the names already shown in the frontend copy so the
 * seeded numbers line up with what a demo viewer sees on screen.
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { subDays, subHours, addDays } from "./dateHelpers.js";

const prisma = new PrismaClient();

/**
 * Money is stored in paise (₹1 = 100 paise) so integer math avoids the usual
 * floating-point drift on totals and ledger balances.
 */
const rupees = (inr: number) => Math.round(inr * 100);

async function main() {
  console.log("Seeding SkillSwap demo data…");

  // ─── Categories: 6 specialist hubs matching the frontend colours ──────
  const categoryDefs = [
    { slug: "3d-clay", name: "3D Clay & Toys", colorToken: "brand-pink", iconName: "auto_awesome", gigCount: 340 },
    { slug: "visual-identity", name: "Visual Identity", colorToken: "brand-teal", iconName: "brush", gigCount: 420 },
    { slug: "motion-vfx", name: "Motion & VFX", colorToken: "brand-lavender", iconName: "play_shapes", gigCount: 290 },
    { slug: "viral-formats", name: "Viral Formats", colorToken: "brand-peach", iconName: "smart_display", gigCount: 510 },
    { slug: "frontend-app", name: "Frontend & App", colorToken: "brand-ochre", iconName: "terminal", gigCount: 180 },
    { slug: "ai-workflows", name: "AI Workflows", colorToken: "brand-mint", iconName: "psychology", gigCount: 215 },
  ] as const;

  const categories: Record<string, string> = {};
  for (const def of categoryDefs) {
    const cat = await prisma.category.upsert({
      where: { slug: def.slug },
      update: {
        name: def.name,
        colorToken: def.colorToken,
        iconName: def.iconName,
        gigCount: def.gigCount,
      },
      create: def,
    });
    categories[def.slug] = cat.id;
  }

  // ─── Users ─────────────────────────────────────────────────────────────
  const userDefs = [
    // Creators (populate the marketplace).
    {
      handle: "milaclay",
      name: "Mila Fontaine",
      city: "Berlin, DE",
      isCreator: true,
      bio: "Tactile 3D & motion lead. Former Lead 3D Artist at MonoType Studio.",
      toolStack: ["Blender 4.2", "Spline 3D", "Three.js", "Cinema 4D"],
      skillsOffered: ["Blender Claymation", "Packaging Design", "Art Direction"],
      avatarUrl: "https://i.pravatar.cc/240?u=milaclay",
      successScore: 99.4,
      responseHours: 1.8,
      gigsCompleted: 142,
      ratingAverage: 4.98,
      reviewCount: 84,
    },
    {
      handle: "kaitovfx",
      name: "Kaito Tanaka",
      city: "Tokyo, JP",
      isCreator: true,
      bio: "Viral video pacing & Premiere Pro cuts. Edited for creators with 12M+ views.",
      toolStack: ["Premiere Pro", "DaVinci Resolve", "After Effects"],
      skillsOffered: ["Short-form Editing", "Kinetic Typography", "Sound Design"],
      avatarUrl: "https://i.pravatar.cc/240?u=kaitovfx",
      successScore: 96.1,
      responseHours: 3.2,
      gigsCompleted: 68,
      ratingAverage: 5.0,
      reviewCount: 42,
    },
    {
      handle: "sorendesign",
      name: "Soren Lindqvist",
      city: "Copenhagen, DK",
      isCreator: true,
      bio: "Next.js & creative technologist. Bespoke micro-interactions and three.js scenes.",
      toolStack: ["Next.js", "Tailwind", "Three.js", "Supabase"],
      skillsOffered: ["Next.js", "Tailwind Systems", "Framer Motion"],
      avatarUrl: "https://i.pravatar.cc/240?u=sorendesign",
      successScore: 94.7,
      responseHours: 2.4,
      gigsCompleted: 91,
      ratingAverage: 4.96,
      reviewCount: 63,
    },
    {
      handle: "ariathorne",
      name: "Aria Thorne",
      city: "London, UK",
      isCreator: true,
      bio: "Design System Architect. Production Figma tokens and multi-theme kits.",
      toolStack: ["Figma", "Tokens Studio", "Storybook"],
      skillsOffered: ["Design Systems", "Figma Architecture", "Tokens"],
      avatarUrl: "https://i.pravatar.cc/240?u=ariathorne",
      successScore: 98.2,
      responseHours: 1.5,
      gigsCompleted: 54,
      ratingAverage: 5.0,
      reviewCount: 38,
    },
    {
      handle: "leonzhang",
      name: "Leon Zhang",
      city: "Shanghai, CN",
      isCreator: true,
      bio: "Tactile brand identity suites and physical-feel 3D asset guidelines.",
      toolStack: ["Illustrator", "Blender", "Cinema 4D"],
      skillsOffered: ["Brand Identity", "Packaging", "3D Product"],
      avatarUrl: "https://i.pravatar.cc/240?u=leonzhang",
      successScore: 95.8,
      responseHours: 4.1,
      gigsCompleted: 47,
      ratingAverage: 4.97,
      reviewCount: 29,
    },
    {
      handle: "felixvance",
      name: "Felix Vance",
      city: "Los Angeles, US",
      isCreator: true,
      bio: "Viral TikTok & Reels editing systems. 48h batch delivery.",
      toolStack: ["Premiere Pro", "CapCut", "Final Cut Pro"],
      skillsOffered: ["Short-form Editing", "Hook Writing", "Custom LUTs"],
      avatarUrl: "https://i.pravatar.cc/240?u=felixvance",
      successScore: 93.4,
      responseHours: 2.8,
      gigsCompleted: 112,
      ratingAverage: 4.95,
      reviewCount: 57,
    },
    {
      handle: "taliaclay",
      name: "Talia Clay",
      city: "Amsterdam, NL",
      isCreator: true,
      bio: "3D clay characters and playful mascots for Web & app.",
      toolStack: ["Blender", "Substance Painter", "Spline"],
      skillsOffered: ["Character Modeling", "Rigging", "Turntable Renders"],
      avatarUrl: "https://i.pravatar.cc/240?u=taliaclay",
      successScore: 97.6,
      responseHours: 2.2,
      gigsCompleted: 63,
      ratingAverage: 4.99,
      reviewCount: 41,
    },

    // Client-facing persona (the frontend's dashboard "Welcome back, Maya").
    {
      handle: "mayarivera",
      name: "Maya Rivera",
      city: "Austin, US",
      isCreator: false,
      bio: "Founder at Playbase. Buys creator services to ship product launches.",
      toolStack: [],
      skillsOffered: [],
      avatarUrl: "https://i.pravatar.cc/240?u=mayarivera",
    },
    // Additional clients that show up as reviewers in the frontend copy.
    {
      handle: "julianvance",
      name: "Julian Vance",
      isCreator: false,
      bio: "Founder at Playbase.",
      city: "New York, US",
      avatarUrl: "https://i.pravatar.cc/240?u=julianvance",
    },
    {
      handle: "tarathorne",
      name: "Tara Thorne",
      isCreator: false,
      bio: "Head of Brand at Kuma.",
      city: "Berlin, DE",
      avatarUrl: "https://i.pravatar.cc/240?u=tarathorne",
    },
  ] satisfies Prisma.UserCreateInput[];

  const users: Record<string, string> = {};
  for (const u of userDefs) {
    const created = await prisma.user.upsert({
      where: { handle: u.handle },
      update: u,
      create: u,
    });
    users[u.handle] = created.id;
  }

  // ─── Gigs ─────────────────────────────────────────────────────────────
  const gigDefs = [
    {
      slug: "mila-3d-clay-character-modeling",
      creatorHandle: "milaclay",
      categorySlug: "3d-clay",
      title: "3D Clay Character Modeling & Rigging for Web & App Mascots",
      description:
        "I craft original, bespoke 3D clay characters engineered for high-converting SaaS landing pages, consumer apps, and micro-interactions. Unlike generic 3D glossy renders, my figures possess real-world clay imperfection textures — subtle thumbprints, sculpted creases, and organic tactile geometry that create instant warmth and high memorability for your brand.",
      disciplineTags: ["3D Clay", "Rigging", ".GLB", "Blender"],
      turnaroundDays: 3,
      coverBadge: "Popular",
      viewCount: 1420,
      bookingCount: 84,
      ratingAverage: 4.98,
      reviewCount: 84,
      tiers: [
        {
          name: "Starter Clay Mascot",
          slug: "basic",
          price: rupees(14940),
          revisions: 1,
          deliveryDays: 2,
          deliverables: [
            "1 Custom 3D Clay Character",
            "Basic Static T-Pose Mesh",
            "Transparent PNG Renders (2K)",
            "Personal License",
          ],
        },
        {
          name: "Standard Mascot Suite",
          slug: "standard",
          price: rupees(26560),
          revisions: 2,
          deliveryDays: 3,
          isFeatured: true,
          deliverables: [
            "2 Custom 3D Clay Characters",
            "Full Armature Rigging (IK & FK)",
            "Web-Ready glTF & GLB Exports",
            "Unbaked Blender Source File",
            "Commercial Use License",
          ],
        },
        {
          name: "Complete Studio Identity",
          slug: "premium",
          price: rupees(45650),
          revisions: 999, // treated as "Unlimited" in the UI
          deliveryDays: 5,
          deliverables: [
            "4 Custom Rigged Characters",
            "6 Custom Looping Animations",
            "Ready-to-use Spline 3D Embed Scene",
            "Blender, glTF, FBX, OBJ Files",
            "Full Commercial Copyright Buyout",
          ],
        },
      ],
    },
    {
      slug: "felix-viral-reels-pack",
      creatorHandle: "felixvance",
      categorySlug: "viral-formats",
      title: "Viral TikTok & Reels Editing System (5 Video Pack with Hooks)",
      description:
        "High-retention cuts, kinetic typography, dynamic sound design, and narrative hooks. Delivered in batches of 5.",
      disciplineTags: ["48h Batch", "Sound Effects", "Custom LUTs"],
      turnaroundDays: 2,
      coverBadge: "Fast Delivery",
      viewCount: 980,
      bookingCount: 57,
      ratingAverage: 4.95,
      reviewCount: 57,
      tiers: [
        { name: "Starter", slug: "basic", price: rupees(20750), revisions: 1, deliveryDays: 3, deliverables: ["5 short-form edits", "Basic captions"] },
        { name: "Growth", slug: "standard", price: rupees(34860), revisions: 2, deliveryDays: 3, isFeatured: true, deliverables: ["5 edits", "Custom LUT pack", "Hook copy"] },
        { name: "Studio", slug: "premium", price: rupees(59760), revisions: 4, deliveryDays: 4, deliverables: ["10 edits", "Sound design", "Thumbnail set"] },
      ],
    },
    {
      slug: "aria-figma-design-system",
      creatorHandle: "ariathorne",
      categorySlug: "visual-identity",
      title: "Production Figma Design System Architecture & Multi-Theme Tokens",
      description:
        "W3C tokens, auto-layout v5 primitives, light + dark mode wired via Tokens Studio. Ships with Storybook stories.",
      disciplineTags: ["W3C Tokens", "Auto Layout v5", "Dark Mode"],
      turnaroundDays: 5,
      viewCount: 640,
      bookingCount: 38,
      ratingAverage: 5.0,
      reviewCount: 38,
      tiers: [
        { name: "Audit", slug: "basic", price: rupees(26560), revisions: 1, deliveryDays: 4, deliverables: ["Token audit", "Contrast report"] },
        { name: "Kit", slug: "standard", price: rupees(56440), revisions: 2, deliveryDays: 6, isFeatured: true, deliverables: ["Full token set", "Component library", "Storybook wiring"] },
        { name: "White-Glove", slug: "premium", price: rupees(99600), revisions: 4, deliveryDays: 10, deliverables: ["Everything in Kit", "Team workshop", "Rollout plan"] },
      ],
    },
    {
      slug: "leon-tactile-brand-identity",
      creatorHandle: "leonzhang",
      categorySlug: "visual-identity",
      title: "Tactile Brand Identity Suite & Physical-Feel 3D Asset Guidelines",
      description:
        "Vector + 3D brand books with embossed letterpress mockups, ceramic packaging, and mascot seals.",
      disciplineTags: ["Vector + 3D", "Brand Book", "5 Days"],
      turnaroundDays: 5,
      coverBadge: "Escrow",
      viewCount: 420,
      bookingCount: 29,
      ratingAverage: 4.97,
      reviewCount: 29,
      tiers: [
        { name: "Mark", slug: "basic", price: rupees(37350), revisions: 1, deliveryDays: 5, deliverables: ["Wordmark + monogram", "Color palette"] },
        { name: "Suite", slug: "standard", price: rupees(68060), revisions: 2, deliveryDays: 7, isFeatured: true, deliverables: ["Full brand book", "3D asset guidelines"] },
        { name: "Rollout", slug: "premium", price: rupees(124500), revisions: 3, deliveryDays: 12, deliverables: ["Everything in Suite", "Packaging renders", "Motion sting"] },
      ],
    },
    {
      slug: "talia-clay-character-mascots",
      creatorHandle: "taliaclay",
      categorySlug: "3d-clay",
      title: "Clay Mascot Characters for Product Landing Pages",
      description: "Hand-sculpted digital clay mascots ready for Spline and Three.js embeds.",
      disciplineTags: ["Mascots", "Spline", "Three.js"],
      turnaroundDays: 4,
      viewCount: 310,
      bookingCount: 41,
      ratingAverage: 4.99,
      reviewCount: 41,
      tiers: [
        { name: "Single", slug: "basic", price: rupees(18260), revisions: 1, deliveryDays: 3, deliverables: ["1 mascot", "3 poses"] },
        { name: "Family", slug: "standard", price: rupees(32370), revisions: 2, deliveryDays: 5, isFeatured: true, deliverables: ["3 mascots", "Turntables"] },
      ],
    },
    {
      slug: "soren-nextjs-landing",
      creatorHandle: "sorendesign",
      categorySlug: "frontend-app",
      title: "Next.js Tactile Landing Pages with Framer Motion Micro-Interactions",
      description: "Production-ready Next.js + Tailwind landing pages with animated hero and micro-interactions.",
      disciplineTags: ["Next.js", "Tailwind", "Framer Motion"],
      turnaroundDays: 6,
      viewCount: 512,
      bookingCount: 63,
      ratingAverage: 4.96,
      reviewCount: 63,
      tiers: [
        { name: "Single Page", slug: "basic", price: rupees(33200), revisions: 2, deliveryDays: 5, deliverables: ["1 landing page", "Responsive"] },
        { name: "Marketing Site", slug: "standard", price: rupees(78850), revisions: 3, deliveryDays: 10, isFeatured: true, deliverables: ["Home + 3 sub pages", "CMS wiring"] },
      ],
    },
  ];

  const gigIds: Record<string, string> = {};
  const tierIds: Record<string, string> = {};
  for (const g of gigDefs) {
    const gig = await prisma.gig.upsert({
      where: { slug: g.slug },
      update: {
        title: g.title,
        description: g.description,
        disciplineTags: g.disciplineTags,
        turnaroundDays: g.turnaroundDays,
        coverBadge: g.coverBadge ?? null,
        viewCount: g.viewCount,
        bookingCount: g.bookingCount,
        ratingAverage: g.ratingAverage,
        reviewCount: g.reviewCount,
        categoryId: categories[g.categorySlug]!,
        creatorId: users[g.creatorHandle]!,
        status: "PUBLISHED",
      },
      create: {
        slug: g.slug,
        title: g.title,
        description: g.description,
        disciplineTags: g.disciplineTags,
        turnaroundDays: g.turnaroundDays,
        coverBadge: g.coverBadge ?? null,
        viewCount: g.viewCount,
        bookingCount: g.bookingCount,
        ratingAverage: g.ratingAverage,
        reviewCount: g.reviewCount,
        categoryId: categories[g.categorySlug]!,
        creatorId: users[g.creatorHandle]!,
        status: "PUBLISHED",
      },
    });
    gigIds[g.slug] = gig.id;

    for (const t of g.tiers) {
      const tier = await prisma.gigTier.upsert({
        where: { gigId_slug: { gigId: gig.id, slug: t.slug } },
        update: {
          name: t.name,
          price: t.price,
          revisions: t.revisions,
          deliveryDays: t.deliveryDays,
          deliverables: t.deliverables,
          isFeatured: t.isFeatured ?? false,
        },
        create: {
          gigId: gig.id,
          name: t.name,
          slug: t.slug,
          price: t.price,
          revisions: t.revisions,
          deliveryDays: t.deliveryDays,
          deliverables: t.deliverables,
          isFeatured: t.isFeatured ?? false,
        },
      });
      tierIds[`${g.slug}:${t.slug}`] = tier.id;
    }
  }

  // ─── Reviews on Mila's headline gig (three from the frontend copy) ────
  const milaGigId = gigIds["mila-3d-clay-character-modeling"]!;
  const reviewDefs = [
    {
      handle: "julianvance",
      rating: 5,
      daysAgo: 4,
      comment:
        "Mila blew our team away. She modeled our robot mascot with an authentic tactile clay texture that looked like it was handmade on a desk. The Three.js export dropped seamlessly into our hero banner without any fps drop. Will hire again next month!",
    },
    {
      handle: "tarathorne",
      rating: 5,
      daysAgo: 16,
      comment:
        "Mila delivered the .blend file with clear armature controls so our internal animator could build extra loops. Smooth process, clean handoff.",
    },
    {
      handle: "sorendesign",
      rating: 5,
      daysAgo: 30,
      comment:
        "Speed is incredible. Delivered 24 hours ahead of schedule. The rigging holds up under extreme deformation without ugly mesh clipping. 10/10 craftsmanship.",
    },
  ];
  // Blow away and re-seed reviews idempotently (no natural upsert key).
  await prisma.review.deleteMany({ where: { gigId: milaGigId, bookingId: null } });
  for (const r of reviewDefs) {
    await prisma.review.create({
      data: {
        gigId: milaGigId,
        clientId: users[r.handle]!,
        rating: r.rating,
        comment: r.comment,
        createdAt: subDays(new Date(), r.daysAgo),
      },
    });
  }

  // ─── Bookings for Maya (client) covering every status tab ─────────────
  // Wipe demo bookings and their child rows for a clean re-seed.
  const demoBookingIds = ["ORD-8921", "ORD-7734", "ORD-6502", "ORD-5019"];
  await prisma.review.deleteMany({ where: { bookingId: { in: demoBookingIds } } });
  await prisma.escrowLedgerEntry.deleteMany({ where: { bookingId: { in: demoBookingIds } } });
  await prisma.milestone.deleteMany({ where: { bookingId: { in: demoBookingIds } } });
  await prisma.activityEvent.deleteMany({ where: { bookingId: { in: demoBookingIds } } });
  await prisma.booking.deleteMany({ where: { id: { in: demoBookingIds } } });

  const platformFeePaise = (subtotalPaise: number) => Math.round(subtotalPaise * 0.05);

  interface BookingSeed {
    id: string;
    gigSlug: string;
    tierSlug: string;
    clientHandle: string;
    creatorHandle: string;
    briefText: string;
    rush?: boolean;
    status: "PENDING" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED";
    createdDaysAgo: number;
    milestones: { title: string; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; daysOffset: number }[];
  }

  const bookingSeeds: BookingSeed[] = [
    {
      id: "ORD-8921",
      gigSlug: "mila-3d-clay-character-modeling",
      tierSlug: "standard",
      clientHandle: "mayarivera",
      creatorHandle: "milaclay",
      briefText:
        "Creation of 3 tactile character assets matching our cozy aesthetic for the launch sprint, with Blender rig setup and Unity-ready GLB exports.",
      status: "IN_PROGRESS",
      createdDaysAgo: 12,
      milestones: [
        { title: "Order Placed & Escrow Funded", status: "COMPLETED", daysOffset: 0 },
        { title: "First Draft Delivered", status: "COMPLETED", daysOffset: 6 },
        { title: "Final Assets & Source Rig", status: "IN_PROGRESS", daysOffset: 2 },
      ],
    },
    {
      id: "ORD-7734",
      gigSlug: "felix-viral-reels-pack",
      tierSlug: "basic",
      clientHandle: "mayarivera",
      creatorHandle: "felixvance",
      briefText:
        "Pack of 5 vertical edits for our Q4 launch. Punchy hooks, retention pacing, on-brand LUT.",
      rush: true,
      status: "PENDING",
      createdDaysAgo: 1,
      milestones: [
        { title: "Awaiting Creator Acceptance", status: "PENDING", daysOffset: 0 },
      ],
    },
    {
      id: "ORD-6502",
      gigSlug: "aria-figma-design-system",
      tierSlug: "basic",
      clientHandle: "mayarivera",
      creatorHandle: "ariathorne",
      briefText:
        "Audit our existing Figma library, produce a contrast + tokens report, and recommend a migration path.",
      status: "ACCEPTED",
      createdDaysAgo: 3,
      milestones: [
        { title: "Order Placed & Escrow Funded", status: "COMPLETED", daysOffset: 0 },
        { title: "Audit Report", status: "IN_PROGRESS", daysOffset: 3 },
      ],
    },
    {
      id: "ORD-5019",
      gigSlug: "leon-tactile-brand-identity",
      tierSlug: "basic",
      clientHandle: "mayarivera",
      creatorHandle: "leonzhang",
      briefText: "Wordmark and monogram for our seed-stage rebrand.",
      status: "COMPLETED",
      createdDaysAgo: 45,
      milestones: [
        { title: "Order Placed & Escrow Funded", status: "COMPLETED", daysOffset: 0 },
        { title: "Concept Delivered", status: "COMPLETED", daysOffset: 4 },
        { title: "Final Files & Escrow Released", status: "COMPLETED", daysOffset: 8 },
      ],
    },
  ];

  for (const b of bookingSeeds) {
    const tierId = tierIds[`${b.gigSlug}:${b.tierSlug}`]!;
    const tier = await prisma.gigTier.findUniqueOrThrow({ where: { id: tierId } });
    const rushSurcharge = b.rush ? Number(process.env.RUSH_SURCHARGE_PAISE ?? 500_000) : 0;
    const subtotal = tier.price + rushSurcharge;
    const platformFee = platformFeePaise(subtotal);
    const total = subtotal + platformFee;

    const createdAt = subDays(new Date(), b.createdDaysAgo);
    const acceptedAt = b.status !== "PENDING" ? subHours(createdAt, -6) : null;
    const deliveredAt = b.status === "COMPLETED" ? subDays(new Date(), b.createdDaysAgo - 8) : null;
    const approvedAt = b.status === "COMPLETED" ? subDays(new Date(), b.createdDaysAgo - 9) : null;
    const completedAt = b.status === "COMPLETED" ? subDays(new Date(), b.createdDaysAgo - 9) : null;
    const dueAt =
      b.status === "IN_PROGRESS"
        ? addDays(new Date(), 2)
        : b.status === "ACCEPTED"
          ? addDays(new Date(), tier.deliveryDays)
          : null;

    const booking = await prisma.booking.create({
      data: {
        id: b.id,
        gigId: gigIds[b.gigSlug]!,
        tierId,
        clientId: users[b.clientHandle]!,
        creatorId: users[b.creatorHandle]!,
        briefText: b.briefText,
        attachments: [],
        deliveryPace: b.rush ? "RUSH" : "STANDARD",
        priceAtBooking: tier.price,
        rushSurcharge,
        platformFee,
        totalCharged: total,
        status: b.status,
        createdAt,
        acceptedAt,
        deliveredAt,
        approvedAt,
        completedAt,
        dueAt,
      },
    });

    for (const [idx, m] of b.milestones.entries()) {
      await prisma.milestone.create({
        data: {
          bookingId: booking.id,
          title: m.title,
          status: m.status,
          position: idx,
          dueDate: addDays(createdAt, m.daysOffset),
          completedAt: m.status === "COMPLETED" ? addDays(createdAt, m.daysOffset) : null,
        },
      });
    }

    // Escrow ledger reflects the real lifecycle.
    let balance = 0;
    const writeEntry = async (
      type: "HOLD" | "RELEASE" | "REFUND" | "PLATFORM_FEE",
      amount: number,
      memo: string,
      when: Date,
    ) => {
      balance += amount;
      await prisma.escrowLedgerEntry.create({
        data: {
          bookingId: booking.id,
          type,
          amount,
          balanceAfter: balance,
          memo,
          createdAt: when,
        },
      });
    };
    await writeEntry("HOLD", total, `Escrow hold for ${b.id}`, createdAt);
    if (b.status === "COMPLETED") {
      // On approval the creator receives the subtotal, platform keeps the fee.
      await writeEntry("PLATFORM_FEE", -platformFee, "Platform fee", completedAt!);
      await writeEntry("RELEASE", -subtotal, "Payout to creator", completedAt!);
    }

    // Activity feed rows so the dashboard has something to render.
    await prisma.activityEvent.createMany({
      data: [
        { userId: booking.creatorId, type: "BOOKING_CREATED", bookingId: booking.id, createdAt },
        { userId: booking.clientId, type: "ESCROW_HELD", bookingId: booking.id, createdAt },
        ...(b.status === "COMPLETED"
          ? [
              { userId: booking.creatorId, type: "ESCROW_RELEASED", bookingId: booking.id, createdAt: completedAt! } as const,
              { userId: booking.clientId, type: "BOOKING_APPROVED", bookingId: booking.id, createdAt: completedAt! } as const,
            ]
          : []),
      ],
    });

    // A review for the completed booking, so My Bookings / Completed shows a
    // rating attached to a real order.
    if (b.status === "COMPLETED") {
      await prisma.review.create({
        data: {
          gigId: booking.gigId,
          bookingId: booking.id,
          clientId: booking.clientId,
          rating: 5,
          comment: "Fast, polished, exactly on brief. Would rebook.",
          createdAt: completedAt!,
        },
      });
    }
  }

  // ─── Recompute cached category gig counts from actual rows ────────────
  for (const def of categoryDefs) {
    const actual = await prisma.gig.count({
      where: { categoryId: categories[def.slug]!, status: "PUBLISHED" },
    });
    // If actual is small (demo seed only has ~6 gigs), keep the marketing
    // number that shows in the UI so the "340+ Gigs" pill stays plausible.
    await prisma.category.update({
      where: { slug: def.slug },
      data: { gigCount: Math.max(actual, def.gigCount) },
    });
  }

  console.log(
    `Seed complete: ${userDefs.length} users, ${categoryDefs.length} categories, ${gigDefs.length} gigs, ${bookingSeeds.length} bookings.`,
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
