"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog, DropdownMenu } from "radix-ui";
import { useTheme } from "next-themes";
import {
  Activity,
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
} from "lucide-react";

import { signOut } from "@/app/actions/auth";
import { Avatar, Badge, cn } from "@/components/ui";

const NAV = [
  {
    label: "Daily work",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/stories", label: "Story inbox", icon: Rss },
      { href: "/review", label: "Review queue", icon: ClipboardCheck },
      { href: "/jobs", label: "Draft jobs", icon: ListChecks },
    ],
  },
  {
    label: "Sites",
    items: [{ href: "/websites", label: "Websites", icon: Globe, match: ["/websites", "/articles", "/sources"] }],
  },
  {
    label: "Administration",
    items: [
      { href: "/niches", label: "Niches", icon: Layers, adminOnly: true },
      { href: "/users", label: "Users", icon: Users, adminOnly: true },
      { href: "/costs", label: "Costs", icon: Receipt, adminOnly: true },
      { href: "/network", label: "Network settings", icon: Settings, adminOnly: true },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

function isActive(pathname, item) {
  if (item.exact) return pathname === item.href;
  return (item.match ?? [item.href]).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function Brand({ appEnv }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white shadow-sm shadow-primary/30">
          <Newspaper className="size-4" />
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight">Publishing Network</span>
          <span className="block text-[0.7rem] text-muted-foreground">Editorial control centre</span>
        </span>
      </Link>
      {appEnv !== "production" ? (
        <Badge tone="amber" className="px-1.5 text-[0.65rem] uppercase">
          {appEnv}
        </Badge>
      ) : null}
    </div>
  );
}

function Nav({ isAdmin, onNavigate, attention = {} }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-6">
      {NAV.map((section) => {
        const items = section.items.filter((item) => !item.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <div key={section.label}>
            <div className="mb-1.5 px-3 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground/80">
              {section.label === "Administration" && !isAdmin ? "History" : section.label}
            </div>
            <ul className="space-y-0.5">
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
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                        )}
                      />
                      {item.label}
                      {attention[item.href] > 0 ? (
                        <span
                          className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs tabular-nums text-accent-foreground"
                          aria-label={`${attention[item.href]} ${item.href === "/jobs" ? "failed jobs" : "waiting for review"}`}
                        >
                          {attention[item.href]}
                        </span>
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

function UserMenu({ user, side = "top", align = "start", compact = false }) {
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

function SidebarBody({ user, appEnv, onNavigate, attention }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-6">
        <Brand appEnv={appEnv} />
      </div>
      <div className="flex-1 overflow-y-auto px-3">
        <Nav isAdmin={user.isAdmin} onNavigate={onNavigate} attention={attention} />
      </div>
      <div className="border-t border-sidebar-border p-2">
        <UserMenu user={user} />
      </div>
    </div>
  );
}

function ActionNotice() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const show = (event) => setMessage(String(event.detail));
    window.addEventListener("pn-notice", show);
    return () => window.removeEventListener("pn-notice", show);
  }, []);
  return message ? (
    <div
      role="status"
      className="fixed right-4 bottom-4 left-4 z-50 flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-sm shadow-lg sm:left-auto sm:max-w-sm"
    >
      <span className="min-w-0 break-words">{message}</span>
      <button
        aria-label="Dismiss notification"
        className="rounded p-1 focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => setMessage("")}
      >
        <X className="size-4" />
      </button>
    </div>
  ) : null;
}

export function AppShell({ user, appEnv, children, attention }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <ActionNotice />
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody user={user} appEnv={appEnv} attention={attention} />
      </aside>

      {/* Mobile top bar + drawer */}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-lg supports-backdrop-filter:bg-background/70 lg:hidden">
          <Dialog.Trigger
            className="-ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Dialog.Trigger>
          <Link href="/" className="flex min-w-0 items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-violet-500 text-white">
              <Newspaper className="size-3.5" />
            </span>
            <span className="truncate">Publishing Network</span>
          </Link>
          <div className="ml-auto shrink-0">
            <UserMenu user={user} side="bottom" align="end" compact />
          </div>
        </header>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in lg:hidden" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-sidebar-border bg-sidebar shadow-2xl outline-none data-[state=open]:animate-slide-in-left lg:hidden">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">Main dashboard navigation</Dialog.Description>
            <Dialog.Close
              className="absolute top-5 right-3 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close navigation"
            >
              <X className="size-4" />
            </Dialog.Close>
            <SidebarBody user={user} appEnv={appEnv} attention={attention} onNavigate={() => setOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[60] focus:rounded focus:bg-card focus:p-3 focus:text-primary"
      >
        Skip to content
      </a>
      <main id="main-content" className="min-w-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
