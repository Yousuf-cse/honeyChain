"use client";

import { useState, useEffect } from "react";
import { useReadContract } from "wagmi";
import { Card, Button, Badge, StatBlock } from "@/components/ui";
import { HONEY_BATCH_NFT_ABI, STATE_MAP } from "@/abi/HoneyBatchNFT";

const BATCH_NFT = process.env.NEXT_PUBLIC_BATCH_NFT_ADDRESS as `0x${string}`;

export default function AdminDashboard() {
  const { data: totalSupply } = useReadContract({
    address: BATCH_NFT,
    abi: HONEY_BATCH_NFT_ABI,
    functionName: "totalSupply",
  });

  return (
    <div className="max-w-7xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-3xl font-black uppercase tracking-tighter">
            Admin Panel
          </h1>
          <div className="h-1 w-16 bg-honey border-2 border-ink mt-2" />
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Manage Roles</Button>
          <Button variant="honey">View Escrow</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
        <StatBlock value={totalSupply?.toString() || "0"} label="Total Batches" accent />
        <StatBlock value="—" label="Active Devices" />
        <StatBlock value="—" label="Verified Proofs" />
        <StatBlock value="—" label="Open Escrows" />
      </div>

      <Card>
        <h2 className="section-heading text-sm">All Batches</h2>
        <table className="brutalist-table w-full">
          <thead>
            <tr>
              <th>Token</th>
              <th>Batch ID</th>
              <th>State</th>
              <th>Weight</th>
              <th>ZK</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.min(Number(totalSupply || 0), 20) }, (_, i) => (
              <BatchRow key={i + 1} tokenId={i + 1} />
            ))}
            {(!totalSupply || Number(totalSupply) === 0) && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted font-bold">No batches on-chain</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BatchRow({ tokenId }: { tokenId: number }) {
  const { data } = useReadContract({
    address: process.env.NEXT_PUBLIC_BATCH_NFT_ADDRESS as `0x${string}`,
    abi: HONEY_BATCH_NFT_ABI,
    functionName: "getBatch",
    args: [BigInt(tokenId)],
  });

  const batch = data as any;
  if (!batch || !batch.batchId) return null;

  const stateVariant = batch.state === 2 ? "success" : batch.state === 1 ? "warning" : "default";

  return (
    <tr>
      <td className="font-black">{tokenId}</td>
      <td className="font-bold">{batch.batchId}</td>
      <td>
        <Badge variant={stateVariant as any} size="sm">
          {STATE_MAP[batch.state]}
        </Badge>
      </td>
      <td className="font-black">{Number(batch.honeyWeightKg) / 1e18} kg</td>
      <td className="font-black">{batch.zkVerified ? "✓" : "—"}</td>
    </tr>
  );
}
