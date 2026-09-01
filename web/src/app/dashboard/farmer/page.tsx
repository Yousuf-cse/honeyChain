"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { Card, Button, Input, Badge } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function FarmerDashboard() {
  const { address } = useAccount();
  const [telemetry, setTelemetry] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [newDevice, setNewDevice] = useState({ deviceId: "", type: "hive_sensor", location: "" });

  useEffect(() => {
    if (!address) return;
    fetch(`${API}/api/v1/telemetry/stats`)
      .then((r) => r.json())
      .then((d) => setTelemetry(d.stats ? [d.stats] : []))
      .catch(() => {});
    fetch(`${API}/api/v1/devices`)
      .then((r) => r.json())
      .then((d) => setDevices(d.devices || []))
      .catch(() => {});
  }, [address]);

  async function registerDevice() {
    if (!newDevice.deviceId) return;
    const res = await fetch(`${API}/api/v1/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newDevice, ownerAddress: address }),
    });
    const data = await res.json();
    if (data.success) {
      setDevices([...devices, data.device]);
      setNewDevice({ deviceId: "", type: "hive_sensor", location: "" });
    }
  }

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="font-mono text-3xl font-black uppercase tracking-tighter">
          Farmer Dashboard
        </h1>
        <div className="h-1 w-16 bg-honey border-2 border-ink mt-2" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <h2 className="section-heading text-sm">Registered Devices</h2>
          {devices.length === 0 ? (
            <div className="border-2 border-dashed border-ink p-8 text-center">
              <p className="font-mono text-sm text-muted font-bold uppercase tracking-wide">No devices registered</p>
            </div>
          ) : (
            <div className="space-y-2">
              {devices.map((d: any) => (
                <div key={d.deviceId} className="flex items-center justify-between border-3 border-ink px-4 py-3 bg-honey/5">
                  <span className="font-mono text-sm font-bold">{d.deviceId}</span>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-5 border-t-2 border-ink space-y-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-muted">Register New Device</span>
            <Input
              label="Device ID"
              placeholder="hive-sensor-001"
              value={newDevice.deviceId}
              onChange={(e) => setNewDevice({ ...newDevice, deviceId: e.target.value })}
            />
            <Input
              label="Location"
              placeholder="Apiary 1, Kufri"
              value={newDevice.location}
              onChange={(e) => setNewDevice({ ...newDevice, location: e.target.value })}
            />
            <Button onClick={registerDevice}>Register Device</Button>
          </div>
        </Card>

        <Card>
          <h2 className="section-heading text-sm">Telemetry Stats</h2>
          {telemetry.length === 0 ? (
            <div className="border-2 border-dashed border-ink p-8 text-center">
              <p className="font-mono text-sm text-muted font-bold uppercase tracking-wide">No telemetry recorded</p>
            </div>
          ) : (
            <div className="space-y-4 font-mono text-sm">
              {[
                { label: "Total Records", value: telemetry[0].totalRecords || 0 },
                { label: "Avg Temperature", value: `${telemetry[0].avgTemp?.toFixed(1) || "—"}°C` },
                { label: "Avg Humidity", value: `${telemetry[0].avgHumidity?.toFixed(1) || "—"}%` },
                { label: "Avg Weight", value: `${telemetry[0].avgWeight?.toFixed(2) || "—"} kg` },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between border-b-2 border-ink pb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted">{s.label}</span>
                  <span className="font-black text-lg">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="section-heading text-sm">Submit Batch for Verification</h2>
        <p className="font-mono text-sm text-muted mb-5 font-medium">
          Submit telemetry data and generate a ZK proof to transition batch to LAB_VERIFIED
        </p>
        <Button variant="honey" className="text-sm px-6 py-3">Submit Telemetry & Prove →</Button>
      </Card>
    </div>
  );
}
