/** The guide's table of contents. Add a page here and create its folder under docs/. */
export const DOC_TOPICS = [
  {
    title: "Start here",
    description: "Understand the daily flow and where people make the decisions.",
    pages: [
      {
        href: "/docs/how-it-works",
        title: "How it works",
        summary: "From finding a story to publishing and measuring it.",
      },
    ],
  },
  {
    title: "Adding a new website",
    description: "Everything needed to bring a new site into the network, in order.",
    pages: [
      { href: "/docs/add-a-website", title: "Overview and checklist", summary: "What you need before you start." },
      {
        href: "/docs/add-a-website/wordpress",
        title: "1. Prepare WordPress",
        summary: "Plugins, publishing user, password and settings.",
      },
      {
        href: "/docs/add-a-website/dashboard",
        title: "2. Add it to the dashboard",
        summary: "Fill in the website form, categories and sources.",
      },
      {
        href: "/docs/add-a-website/google",
        title: "3. Google Analytics and Search Console",
        summary: "Tracking, sitemap and traffic numbers.",
      },
      {
        href: "/docs/add-a-website/go-live",
        title: "4. Start automation and go live",
        summary: "Test, turn on automation and launch.",
      },
    ],
  },
  {
    title: "Stories and articles",
    description: "Choose useful stories, check the writing and publish with confidence.",
    pages: [
      {
        href: "/docs/choosing-stories",
        title: "How stories are chosen",
        summary: "Sources, automatic picks and skipped stories.",
      },
      {
        href: "/docs/ai-drafting",
        title: "AI drafting rules and checks",
        summary: "Evidence, original writing and warnings for the reviewer.",
      },
      {
        href: "/docs/ai-drafting/messages",
        title: "Drafting failure messages",
        summary: "What a stopped draft means and what to do next.",
      },
      {
        href: "/docs/reviewing",
        title: "Reviewing and approving articles",
        summary: "Read, correct, choose an image and approve.",
      },
      {
        href: "/docs/publishing",
        title: "Publishing times and quotas",
        summary: "Automatic slots, chosen schedules and taking an article down.",
      },
    ],
  },
  {
    title: "Settings and access",
    description: "A reference for the choices an administrator can change.",
    pages: [
      {
        href: "/docs/settings",
        title: "Website settings",
        summary: "Names, language, branding, connections and editors.",
      },
      {
        href: "/docs/settings/automation",
        title: "Publishing and automation settings",
        summary: "Times, review mode, story selection and safe starting choices.",
      },
      {
        href: "/docs/settings/sources",
        title: "Niches, sources and categories",
        summary: "Shared settings, writing guides and image permissions.",
      },
      {
        href: "/docs/settings/network",
        title: "Network settings",
        summary: "Shared AI controls, draft checks, recipients and muted websites.",
      },
      {
        href: "/docs/users",
        title: "Users and permissions",
        summary: "Administrator and editor access, invitations and assignments.",
      },
    ],
  },
  {
    title: "Day-to-day operation",
    description: "Keep work moving, watch spending and read the results.",
    pages: [
      { href: "/docs/costs", title: "Costs and budgets", summary: "Estimates, spending limits and monthly exports." },
      {
        href: "/docs/alerts-and-jobs",
        title: "Alerts and failed jobs",
        summary: "Read alerts, recover a draft or remove work that is no longer needed.",
      },
      { href: "/docs/traffic", title: "Traffic", summary: "Visitors, Google searches and when the numbers update." },
    ],
  },
];
