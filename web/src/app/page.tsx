"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex items-center justify-center border-b-[3px] border-ink bg-honey/5">
        <div className="max-w-5xl mx-auto px-6 text-center py-28">
          <div className="font-mono text-[10px] font-black uppercase tracking-[0.3em] text-muted mb-6">
            Blockchain-Backed Traceability
          </div>
          <h1 className="font-mono text-6xl md:text-[5.5rem] font-black uppercase tracking-tighter leading-[0.85] mb-8">
            <span className="block">Verify</span>
            <span className="bg-honey px-5 py-2 inline-block mt-2 border-3 border-ink shadow-[8px_8px_0_var(--color-ink)]">
              Honey
            </span>
            <span className="block mt-2">Authenticity</span>
          </h1>
          <p className="font-mono text-base text-muted max-w-lg mx-auto mb-10 font-medium">
            IoT telemetry. Zero-knowledge proofs. Immutable on-chain records.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/verify">
              <Button>Verify a Batch</Button>
            </Link>
            <Link href="/dashboard/farmer">
              <Button variant="outline">Open Dashboard</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b-[3px] border-ink">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="section-heading text-3xl">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {[
              { step: "01", title: "IoT Capture", desc: "ESP32 sensors record temperature, humidity, and weight from hives in real-time" },
              { step: "02", title: "ZK Proof", desc: "Zero-knowledge circuit proves data integrity without revealing raw telemetry" },
              { step: "03", title: "On-Chain", desc: "ERC-721 batch token with full lifecycle tracking and IPFS documentation" },
            ].map((item, i) => (
              <div
                key={item.step}
                className={`p-8 border-3 border-ink bg-white ${i > 0 ? "border-l-0" : ""}`}
              >
                <span className="font-mono text-5xl font-black text-honey leading-none">{item.step}</span>
                <h3 className="font-mono font-black text-xl uppercase mt-4 mb-3 tracking-tight">{item.title}</h3>
                <p className="font-mono text-sm text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-ink text-paper">
        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-2 md:grid-cols-4 gap-0">
          {[
            { label: "Contracts", value: "3" },
            { label: "Tests Passing", value: "100+" },
            { label: "ZK Circuit", value: "G16" },
            { label: "API Routes", value: "20+" },
          ].map((s, i) => (
            <div key={s.label} className={`p-8 ${i > 0 ? "border-l-[3px] border-paper/20" : ""}`}>
              <p className="font-mono text-4xl font-black leading-none">{s.value}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 mt-3 font-bold">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-ink py-8 px-6 bg-paper">
        <div className="max-w-6xl mx-auto flex items-center justify-between font-mono text-[11px] font-black uppercase tracking-widest text-muted">
          <span>HoneyChain v1.0.0</span>
          <span>Hardhat + Next.js + Circom</span>
        </div>
      </footer>
    </div>
  );
}
