import { Link, useLocation } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { getDisplayName } from "@/lib/session";

export default function Header() {
  const [name, setName] = useState<string | null>(getDisplayName());
  const location = useLocation();

  useEffect(() => {
    const id = setInterval(() => setName(getDisplayName()), 500);
    return () => clearInterval(id);
  }, []);

  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center gap-3">
        <Link to="/" className="font-semibold tracking-tight">
          Zoby Boards
        </Link>
        <nav className="ml-4 hidden md:flex gap-2 text-sm text-muted-foreground">
          <Link to="/" className={!isAdminRoute ? "text-foreground" : ""}>Board</Link>
          <span>•</span>
          <Link to="/admin" className={isAdminRoute ? "text-foreground" : ""}>Admin</Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">Signed in as</span>
          <div className="text-sm font-medium">{name ?? "Guest"}</div>
        </div>
      </div>
    </header>
  );
}
