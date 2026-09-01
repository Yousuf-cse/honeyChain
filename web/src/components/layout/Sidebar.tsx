"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";

const links = [
  { href: "/dashboard/farmer", label: "Farmer", icon: "◆" },
  { href: "/dashboard/lab", label: "Lab", icon: "▲" },
  { href: "/dashboard/admin", label: "Admin", icon: "■" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  if (!isConnected) return null;

  return (
    <aside className="w-52 border-r-[3px] border-ink bg-white min-h-[calc(100vh-4rem)] p-5">
      <div className="mb-8">
        <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">Wallet</span>
        <div className="font-mono text-xs font-bold mt-2 break-all border-2 border-ink px-3 py-2 bg-honey/10">
          {address?.slice(0, 10)}...{address?.slice(-8)}
        </div>
      </div>
      <nav className="space-y-1.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-2 font-mono text-sm font-black uppercase tracking-widest px-3 py-2.5 border-3 border-ink transition-all ${
              pathname === l.href
                ? "bg-honey shadow-[4px_4px_0_var(--color-ink)] -translate-x-0.5 -translate-y-0.5"
                : "bg-white hover:bg-honey/30 shadow-[3px_3px_0_var(--color-ink)] hover:shadow-[5px_5px_0_var(--color-ink)]"
            }`}
          >
            <span className="text-base">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
