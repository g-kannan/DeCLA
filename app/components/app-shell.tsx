"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

type AppShellProps = {
  children: ReactNode;
  status?: "loading" | "saving" | "ready" | "error";
  action?: ReactNode;
  activeDataflowId?: string;
};

const navigation = [
  { href: "/canvas", label: "Process canvas", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg> },
  { href: "/log", label: "Version log", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> },
  { href: "/comparison", label: "Comparison", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21"></line></svg> },
];

export function AppShell({ children, status = "ready", action, activeDataflowId }: AppShellProps) {
  const pathname = usePathname();
  const suffix = activeDataflowId ? `?dataflow=${activeDataflowId}` : "";

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-glow" aria-hidden="true" />
        <Link className="brand" href={`/canvas${suffix}`} aria-label="DeCLA home">
          <span className="brand-mark">D</span>
          <span className="brand-copy"><strong>DeCLA</strong><small>Business process studio</small></span>
        </Link>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link 
              key={item.href} 
              href={`${item.href}${suffix}`} 
              className={pathname === item.href ? "active" : ""}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className={`save-status ${status === "ready" ? "saved" : status}`}>
            <i />{status === "saving" ? "Saving" : status === "loading" ? "Loading" : status === "error" ? "Error" : "Local draft"}
          </span>
        </div>
      </aside>
      <section className="workspace">
        <header className="workspace-bar">
          <span className="workspace-context">Business process workspace</span>
          <div className="topbar-actions">
            <ThemeToggle />
            {action}
          </div>
        </header>
        <div className="page">{children}</div>
      </section>
    </main>
  );
}
