"use client";

import { Badge } from "@/components/ui";

const STEPS = ["RAW_HARVEST", "LAB_VERIFIED", "PACKAGED_RETAIL"] as const;

const LABELS: Record<string, string> = {
  RAW_HARVEST: "Raw Harvest",
  LAB_VERIFIED: "Lab Verified",
  PACKAGED_RETAIL: "Retail",
};

export function BatchTimeline({ state }: { state: string }) {
  const current = STEPS.indexOf(state as (typeof STEPS)[number]);

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 border-3 border-ink flex items-center justify-center font-mono text-sm font-black transition-colors ${
                i <= current ? "bg-honey" : "bg-paper"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </div>
            <span className="font-mono text-[10px] font-black uppercase tracking-widest mt-1.5 whitespace-nowrap">
              {LABELS[step]}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-20 h-1 mx-1 mb-5 ${i < current ? "bg-honey" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ProofBadge({ verified }: { verified: boolean }) {
  return (
    <Badge variant={verified ? "success" : "danger"} size="lg">
      {verified ? "✓ ZK Verified" : "✗ Unverified"}
    </Badge>
  );
}
