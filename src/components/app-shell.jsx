"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, useRef, useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { useTheme } from "next-themes";
import {
  Activity,
  BookOpen,
  ChevronsUpDown,
  ClipboardCheck,
  Globe,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Settings,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Newspaper,
  Layers,
  Rss,
  Sun,
  Users,
  X,
  Receipt,
  Accessibility,
  BellRing,
  FileText,
  Link2,
  Plus,
  Search,
  CalendarRange,
  ClipboardList,
} from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { DOC_TOPICS } from "@/app/(dashboard)/docs/topics";
import { CommandMenu, useCommandShortcut } from "@/components/command-menu";
import { DisplaySettingsDialog } from "@/components/display-settings";
import { Avatar, Badge, cn } from "@/components/ui";

const NAV = [
  {
    label: "Daily work",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/stories", label: "Story inbox", icon: Rss },
      { href: "/review", label: "Review queue", icon: ClipboardCheck },
      { href: "/articles", label: "All articles", icon: FileText, exact: true },
      { href: "/jobs", label: "Draft jobs", icon: ListChecks },
      { href: "/weekly", label: "Weekly report", icon: CalendarRange },
      { href: "/status", label: "Status report", icon: ClipboardList },
    ],
  },
  {
    label: "Sites",
    items: [
      // Article pages belong to a website, so they keep Websites highlighted.
      { href: "/websites", label: "Websites", icon: Globe, match: ["/websites", "/articles/"] },
      { href: "/sources", label: "All sources", icon: Link2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/niches", label: "Niches", icon: Layers, adminOnly: true },
      { href: "/users", label: "Users", icon: Users, adminOnly: true },
      { href: "/costs", label: "Costs", icon: Receipt, adminOnly: true },
      { href: "/network", label: "Network settings", icon: Settings, adminOnly: true, exact: true },
      { href: "/network/alerts", label: "Alerts", icon: BellRing, adminOnly: true },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Help",
    items: [{ href: "/docs", label: "Guide", icon: BookOpen }],
  },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  // A prefix ending in "/" matches only paths below it ("/articles/" is not the /articles list).
  return (item.match ?? [item.href]).some((prefix) =>
    prefix.endsWith("/") ? pathname.startsWith(prefix) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function Brand({ appEnv }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
          <Newspaper className="size-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Publishing Network</span>
          <span className="block text-xs text-muted-foreground">Editorial control centre</span>
        </span>
      </Link>
      {appEnv !== "production" ? (
        <Badge tone="amber" className="px-1.5 text-xs">
          {appEnv}
        </Badge>
      ) : null}
    </div>
  );
}

/** Sidebar count; `attention` is a promise so the counts never hold up the page. */
function AttentionCount({ attention, href }) {
  const count = use(attention)[href];
  return count > 0 ? (
    <span
      className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-foreground"
      aria-label={`${count} ${href === "/jobs" ? "failed jobs" : "waiting for review"}`}
    >
      {count}
    </span>
  ) : null;
}

function Nav({ isAdmin, onNavigate, attention }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      {NAV.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={section.label}>
            <h2 id={`nav-${section.label}`} className="mb-1.5 px-3 text-xs font-medium text-muted-foreground">
              {section.label === "Administration" && !isAdmin ? "History" : section.label}
            </h2>
            <ul aria-labelledby={`nav-${section.label}`} className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                        active
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {item.label}
                      {["/review", "/jobs"].includes(item.href) ? (
                        <Suspense fallback={null}>
                          <AttentionCount attention={attention} href={item.href} />
                        </Suspense>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

const menuItemClass =
  "flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-muted data-highlighted:text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground";

function UserMenu({ user, side = "top", align = "start", compact = false, onDisplaySettings }) {
  const { theme, setTheme } = useTheme();
  const signOutForm = useRef(null);
  const name = user.name || user.email;

  return (
    <>
      <form ref={signOutForm} action={signOut} hidden />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            "flex items-center gap-3 rounded-lg text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40",
            compact ? "rounded-full" : "w-full p-2 hover:bg-muted data-[state=open]:bg-muted",
          )}
          aria-label="Account menu"
        >
          <Avatar name={name} />
          {!compact ? (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {user.isAdmin ? "Administrator" : "Editor"}
                </span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </>
          ) : null}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side={side}
            align={align}
            sideOffset={8}
            className="z-50 w-60 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-zoom-in"
          >
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Avatar name={name} />
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="truncate text-xs text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
            <DropdownMenu.Item asChild className={menuItemClass}>
              <Link href="/account/password">
                <KeyRound />
                Change password
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item className={menuItemClass} onSelect={onDisplaySettings}>
              <Accessibility />
              Display and accessibility
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
            <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
              Theme
            </DropdownMenu.Label>
            <DropdownMenu.RadioGroup
              value={theme}
              onValueChange={setTheme}
              className="grid grid-cols-3 gap-1 px-1 pb-1"
            >
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map(({ value, label, icon: Icon }) => (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  onSelect={(event) => event.preventDefault()}
                  className="flex cursor-default flex-col items-center gap-1 rounded-md border border-transparent px-2 py-1.5 text-xs text-muted-foreground outline-none data-highlighted:bg-muted data-[state=checked]:border-border data-[state=checked]:bg-muted data-[state=checked]:text-foreground"
                >
                  <Icon className="size-4" />
                  {label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
            <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-border" />
            <DropdownMenu.Item className={menuItemClass} onSelect={() => signOutForm.current?.requestSubmit()}>
              <LogOut />
              Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}

function SearchButton({ onClick, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-keyshortcuts="Control+K Meta+K /"
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40",
        className,
      )}
    >
      <Search aria-hidden className="size-4" />
      <span className="flex-1 text-left">Search or jump to…</span>
      <kbd className="rounded border px-1.5 text-[0.7rem]">⌘K</kbd>
    </button>
  );
}

function SidebarBody({ user, appEnv, onNavigate, attention, onSearch, onDisplaySettings }) {
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-4 px-4 pt-5 pb-5">
        {/* In the phone drawer, leave room for its close button. */}
        <div className={onNavigate ? "pr-9" : undefined}>
          <Brand appEnv={appEnv} />
        </div>
        <SearchButton onClick={onSearch} />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <Nav isAdmin={user.isAdmin} onNavigate={onNavigate} attention={attention} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu user={user} onDisplaySettings={onDisplaySettings} />
      </div>
    </div>
  );
}

export function AppShell({ user, appEnv, children, attention, websites }) {
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [displaySettings, setDisplaySettings] = useState(false);
  useCommandShortcut(setSearching);
  const openSearch = () => {
    setOpen(false);
    setSearching(true);
  };
  const openDisplaySettings = () => {
    setOpen(false);
    setDisplaySettings(true);
  };
  const pages = NAV.flatMap((section) =>
    section.items
      .filter((item) => !item.adminOnly || user.isAdmin)
      .map((item) => ({ href: item.href, label: item.label, icon: item.icon, group: "Pages" })),
  );
  const guide = DOC_TOPICS.flatMap((topic) =>
    topic.pages.map((page) => ({
      href: page.href,
      label: page.title.replace(/^\d+\.\s*/, ""),
      icon: BookOpen,
      group: "Guide",
      keywords: `${topic.title} ${page.summary} help docs`,
    })),
  );
  const actions = [
    ...(user.isAdmin ? [{ href: "/websites/new", label: "Add a website", icon: Plus, group: "Actions" }] : []),
    { href: "/account/password", label: "Change password", icon: KeyRound, group: "Actions" },
    {
      label: "Display and accessibility",
      icon: Accessibility,
      group: "Actions",
      keywords: "theme dark light text size font motion contrast",
      run: () => setDisplaySettings(true),
    },
    ...guide,
  ];

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:rounded focus:bg-card focus:p-3 focus:text-primary"
      >
        Skip to content
      </a>
      <CommandMenu open={searching} onOpenChange={setSearching} pages={pages} actions={actions} websites={websites} />
      <DisplaySettingsDialog open={displaySettings} onOpenChange={setDisplaySettings} />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar xl:block">
        <SidebarBody
          user={user}
          appEnv={appEnv}
          attention={attention}
          onSearch={openSearch}
          onDisplaySettings={openDisplaySettings}
        />
      </aside>

      {/* Mobile top bar + drawer */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 xl:hidden">
          <Dialog.Trigger
            className="-ml-1.5 flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
              <Newspaper className="size-3.5" />
            </span>
            <span className="truncate">Publishing Network</span>
          </Link>
          <button
            type="button"
            onClick={openSearch}
            aria-label="Search or jump to"
            className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Search className="size-5" />
          </button>
          <div className="shrink-0">
            <UserMenu user={user} side="bottom" align="end" compact onDisplaySettings={openDisplaySettings} />
          </div>
        </header>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-fade-in xl:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-2xl outline-none data-[state=open]:animate-slide-in-left xl:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main dashboard navigation</Dialog.Description>
            <Dialog.Close
              className="absolute top-5 right-3 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Dialog.Close>
            <SidebarBody
              user={user}
              appEnv={appEnv}
              attention={attention}
              onNavigate={() => setOpen(false)}
              onSearch={openSearch}
              onDisplaySettings={openDisplaySettings}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main id="main-content" tabIndex={-1} className="min-w-0 outline-none xl:pl-64">
        {/* At 1440px: 256px navigation + two 32px gutters + 1120px canvas. Mobile keeps two 16px gutters. */}
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
