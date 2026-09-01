"use client";

import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function Navbar() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <nav className="border-b-[3px] border-ink bg-paper sticky top-0 z-50">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-mono font-black text-xl tracking-tighter uppercase">
            <span className="bg-honey px-3 py-1 border-2 border-ink">Honey</span>
            <span className="ml-1">Chain</span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            <Link href="/verify" className="font-mono text-xs font-black uppercase tracking-widest hover:bg-honey px-3 py-2 border-2 border-transparent hover:border-ink transition-all">
              Verify
            </Link>
            {isConnected && (
              <>
                <Link href="/dashboard/farmer" className="font-mono text-xs font-black uppercase tracking-widest hover:bg-honey px-3 py-2 border-2 border-transparent hover:border-ink transition-all">
                  Farmer
                </Link>
                <Link href="/dashboard/lab" className="font-mono text-xs font-black uppercase tracking-widest hover:bg-honey px-3 py-2 border-2 border-transparent hover:border-ink transition-all">
                  Lab
                </Link>
                <Link href="/dashboard/admin" className="font-mono text-xs font-black uppercase tracking-widest hover:bg-honey px-3 py-2 border-2 border-transparent hover:border-ink transition-all">
                  Admin
                </Link>
              </>
            )}
          </div>
        </div>
        <div>
          {isConnected ? (
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold border-3 border-ink px-3 py-1.5 bg-honey/20">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="brutalist-btn-outline text-[11px] py-1.5 px-4"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => connect({ connector: connectors[0] })}
              className="brutalist-btn text-[11px] py-1.5 px-4"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
