"use client";

import { useState } from "react";
import { usePublicClient } from "wagmi";
import { Card, Input, Button } from "@/components/ui";
import { BatchTimeline, ProofBadge } from "@/components/batch";
import { HONEY_BATCH_NFT_ABI, STATE_MAP } from "@/abi/HoneyBatchNFT";

const CONTRACT = process.env.NEXT_PUBLIC_BATCH_NFT_ADDRESS as `0x${string}`;

interface Batch {
  batchId: string;
  beekeeper: string;
  honeyWeightKg: bigint;
  harvestTimestamp: bigint;
  state: number;
  commitmentHash: string;
  zkVerified: boolean;
  nablReportHash: string;
}

export default function VerifyPage() {
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const publicClient = usePublicClient();

  async function handleVerify() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setBatch(null);
    try {
      let data: Batch;
      if (/^\d+$/.test(query)) {
        data = await publicClient!.readContract({
          address: CONTRACT,
          abi: HONEY_BATCH_NFT_ABI,
          functionName: "getBatch",
          args: [BigInt(query)],
        }) as unknown as Batch;
      } else {
        data = await publicClient!.readContract({
          address: CONTRACT,
          abi: HONEY_BATCH_NFT_ABI,
          functionName: "getBatchByBatchId",
          args: [query.trim()],
        }) as unknown as Batch;
      }
      if (!data.batchId) {
        setError("Batch not found");
      } else {
        setBatch(data);
      }
    } catch {
      setError("Batch not found on-chain");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="font-mono text-4xl font-black uppercase tracking-tighter mb-2">
        Verify Batch
      </h1>
      <div className="h-1 w-20 bg-honey border-2 border-ink mb-4" />
      <p className="font-mono text-sm text-muted mb-10 font-medium">
        Enter a batch ID or token ID to verify authenticity and proof on-chain
      </p>

      <div className="flex gap-3 mb-10">
        <div className="flex-1">
          <Input
            placeholder="HONEY-BATCH-001 or token ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
        </div>
        <Button onClick={handleVerify} disabled={loading}>
          {loading ? "Checking..." : "Verify →"}
        </Button>
      </div>

      {error && (
        <Card className="border-red-700 shadow-[6px_6px_0_theme(colors.red.700)]">
          <p className="font-mono text-sm font-bold text-red-700 uppercase tracking-wide">✗ {error}</p>
        </Card>
      )}

      {batch && (
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">Batch</span>
                <h2 className="font-mono text-2xl font-black uppercase tracking-tight mt-0.5">{batch.batchId}</h2>
              </div>
              <ProofBadge verified={batch.zkVerified} />
            </div>
            <BatchTimeline state={STATE_MAP[batch.state] || "RAW_HARVEST"} />
          </Card>

          <Card>
            <h3 className="section-heading text-sm">Batch Details</h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Beekeeper</span>
                <p className="font-bold break-all text-xs leading-relaxed">{batch.beekeeper}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Weight</span>
                <p className="font-black text-lg">{Number(batch.honeyWeightKg) / 1e18} kg</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Harvest Date</span>
                <p className="font-bold">{new Date(Number(batch.harvestTimestamp) * 1000).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">State</span>
                <p className="font-black uppercase">{STATE_MAP[batch.state]}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Commitment Hash</span>
                <p className="break-all text-[11px] font-bold bg-honey/10 border-2 border-ink px-3 py-2">{batch.commitmentHash}</p>
              </div>
              {batch.nablReportHash && (
                <div className="col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">NABL Report</span>
                  <p className="break-all text-[11px] font-bold bg-honey/10 border-2 border-ink px-3 py-2">{batch.nablReportHash}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
