import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

function TopNavLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function AppShell() {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/inventory" className="text-sm font-semibold tracking-tight">
              Nornir Console
            </Link>
            <nav className="flex items-center gap-1">
              <TopNavLink to="/inventory">库存</TopNavLink>
              <TopNavLink to="/execute">执行</TopNavLink>
              <TopNavLink to="/tasks">任务</TopNavLink>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => window.open(`${apiBaseUrl}/docs`, "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
              API 文档
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}
