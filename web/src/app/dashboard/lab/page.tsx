"use client";

import { useState } from "react";
import { Card, Button, Input, Badge } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function LabDashboard() {
  const [batchId, setBatchId] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function verifyBatch() {
    if (!batchId.trim()) return;
    setVerifying(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/api/v1/verification/prove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batchId.trim(),
          tempMin: 20,
          tempMax: 40,
          humidityMin: 40,
          humidityMax: 85,
          timestampAfter: Math.floor(Date.now() / 1000) - 86400,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Verification failed");
      }
    } catch {
      setError("Could not reach API");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="font-mono text-3xl font-black uppercase tracking-tighter">
          Lab Inspector
        </h1>
        <div className="h-1 w-16 bg-honey border-2 border-ink mt-2" />
        <p className="font-mono text-sm text-muted mt-3 font-medium">
          Verify batch authenticity via ZK proof generation and on-chain validation
        </p>
      </div>

      <Card>
        <h2 className="section-heading text-sm">Generate ZK Proof</h2>
        <div className="flex gap-3 mb-5">
          <div className="flex-1">
            <Input
              placeholder="HONEY-BATCH-001"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyBatch()}
            />
          </div>
          <Button onClick={verifyBatch} disabled={verifying}>
            {verifying ? "Proving..." : "Generate Proof →"}
          </Button>
        </div>

        {error && (
          <div className="border-3 border-red-700 p-4 shadow-[6px_6px_0_theme(colors.red.700)]">
            <p className="font-mono text-sm font-bold text-red-700 uppercase tracking-wide">✗ {error}</p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="success" size="lg">Proof Generated</Badge>
              <span className="font-mono text-xs font-bold text-muted">
                {result.proofDuration?.toFixed(0) || "~1000"}ms
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Batch ID</span>
                <p className="font-black">{result.batchId}</p>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Valid</span>
                <p className="font-black text-lg">{result.valid ? "✓ YES" : "✗ NO"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1">Public Signals</span>
                <p className="text-[11px] font-bold break-all bg-honey/10 border-2 border-ink p-3">{JSON.stringify(result.publicSignals)}</p>
              </div>
            </div>
            <Button variant="honey" className="text-sm px-6 py-3">Upload to IPFS & Update On-Chain →</Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="section-heading text-sm">Pending Verifications</h2>
        <table className="brutalist-table w-full">
          <thead>
            <tr>
              <th>Batch ID</th>
              <th>State</th>
              <th>Proof</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="text-center py-8 text-muted font-bold">No pending batches</td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
}
