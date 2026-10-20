/** The guide's table of contents. Add a page here and create its folder under docs/. */
export const DOC_TOPICS = [
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
];
