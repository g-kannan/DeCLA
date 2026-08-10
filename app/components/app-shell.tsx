"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  status?: "loading" | "saving" | "ready" | "error";
  action?: ReactNode;
  activeDataflowId?: string;
};

const navigation = [
  { href: "/canvas", label: "Process canvas", icon: "C" },
  { href: "/log", label: "Version log", icon: "L" },
  { href: "/comparison", label: "Comparison", icon: "↔" },
];

export function AppShell({ children, status = "ready", action, activeDataflowId }: AppShellProps) {
  const pathname = usePathname();
  const suffix = activeDataflowId ? `?dataflow=${activeDataflowId}` : "";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={`/canvas${suffix}`} aria-label="DeCLA home">
          <span className="brand-mark">D</span>
          <span className="brand-copy"><strong>DeCLA</strong><small>Business process studio</small></span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={`${item.href}${suffix}`} className={pathname === item.href ? "active" : ""}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className={`save-status ${status === "ready" ? "saved" : status}`}>
            <i />{status === "saving" ? "Saving" : status === "loading" ? "Loading" : status === "error" ? "API error" : "Neon connected"}
          </span>
        </div>
      </aside>
      <section className="workspace">
        <header className="workspace-bar">
          <span className="workspace-context">Business process workspace</span>
          <div className="topbar-actions">{action}</div>
        </header>
        <div className="page">{children}</div>
      </section>
    </main>
  );
}
