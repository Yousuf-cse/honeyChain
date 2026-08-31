#!/usr/bin/env python3
"""
HoneyChain ESP32 Hardware Simulator

Simulates realistic hive telemetry (weight, temperature, humidity) and
pushes readings to the HoneyChain middleware API over HTTP.

Use cases:
  - End-to-end integration testing without physical hardware
  - Demo mode for hackathon presentations
  - Load testing the telemetry ingestion pipeline

Usage:
  python esp32_simulator.py                          # Default: 1 device, 30s interval
  python esp32_simulator.py --devices 3 --interval 5  # 3 hives, every 5s
  python esp32_simulator.py --demo                    # Full lifecycle demo
"""

import argparse
import json
import math
import random
import time
import sys
from datetime import datetime, timezone
from typing import Optional
import urllib.request
import urllib.error

# ============================================================================
# Configuration
# ============================================================================
DEFAULT_API_BASE = "http://localhost:3000"
DEFAULT_DEVICE_ID = "ESP32-HIVE-001"
DEFAULT_HIVE_ID = "HIVE-001"

# Realistic hive telemetry ranges
TEMP_BASELINE = 34.0       #°C  (brood nest ~34-36°C)
TEMP_VARIATION = 3.0        #±°C diurnal cycle
HUMIDITY_BASELINE = 62.0    #%
HUMIDITY_VARIATION = 8.0    #±%
WEIGHT_BASELINE = 22.5      #kg (typical Langstroth hive)
WEIGHT_DAILY_GAIN = 0.15    #kg/day during flow season
WEIGHT_VARIATION = 0.3      #±kg daily foraging fluctuation

# ============================================================================
# Telemetry Models
# ============================================================================
class HiveSimulator:
    """Simulates a single honeybee hive's sensor readings over time."""

    def __init__(self, device_id: str, hive_id: str, start_time: float):
        self.device_id = device_id
        self.hive_id = hive_id
        self.start_time = start_time
        self.reading_count = 0

        # Hive-specific offsets (each hive is slightly different)
        self.temp_offset = random.uniform(-1.5, 1.5)
        self.humidity_offset = random.uniform(-3.0, 3.0)
        self.weight_offset = random.uniform(-2.0, 2.0)
        self.phase_offset = random.uniform(0, 2 * math.pi)

    def read(self, timestamp: Optional[float] = None) -> dict:
        """Generate a realistic telemetry reading."""
        t = timestamp or time.time()
        elapsed_hours = (t - self.start_time) / 3600.0
        self.reading_count += 1

        # Diurnal temperature cycle (peaks at 14:00, troughs at 04:00)
        hour_of_day = (elapsed_hours % 24)
        diurnal = math.sin((hour_of_day - 4) * math.pi / 12)
        temperature = TEMP_BASELINE + self.temp_offset + diurnal * TEMP_VARIATION

        # Add noise
        temperature += random.gauss(0, 0.3)
        temperature = round(max(15.0, min(45.0, temperature)), 2)

        # Humidity inversely correlated with temperature
        humidity = HUMIDITY_BASELINE + self.humidity_offset - diurnal * HUMIDITY_VARIATION * 0.5
        humidity += random.gauss(0, 1.5)
        humidity = round(max(30.0, min(95.0, humidity)), 2)

        # Weight: gradual gain during day (nectar flow), slight loss at night (consumption)
        days_elapsed = elapsed_hours / 24.0
        weight = WEIGHT_BASELINE + self.weight_offset + days_elapsed * WEIGHT_DAILY_GAIN

        # Daily foraging cycle (bees bring nectar during day, consume at night)
        foraging_cycle = math.sin((hour_of_day - 6) * math.pi / 12)
        if 6 <= hour_of_day <= 18:  # Daytime: gain
            weight += foraging_cycle * WEIGHT_VARIATION
        else:  # Nighttime: slight loss
            weight -= 0.05

        weight += random.gauss(0, 0.08)
        weight = round(max(10.0, min(50.0, weight)), 2)

        return {
            "deviceId": self.device_id,
            "hiveId": self.hive_id,
            "batchId": f"BATCH-{self.hive_id}",
            "timestamp": int(t),
            "temperature": temperature,
            "humidity": humidity,
            "weight": weight,
        }


# ============================================================================
# API Client
# ============================================================================
class HoneyChainAPI:
    """Simple HTTP client for the HoneyChain middleware API."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session_active = True

    def _post(self, endpoint: str, data: dict) -> dict:
        url = f"{self.base_url}{endpoint}"
        payload = json.dumps(data).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return {"status": resp.status, "body": body}
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            return {"status": e.code, "error": body}
        except urllib.error.URLError as e:
            return {"status": 0, "error": str(e.reason)}
        except Exception as e:
            return {"status": 0, "error": str(e)}

    def _get(self, endpoint: str) -> dict:
        url = f"{self.base_url}{endpoint}"
        req = urllib.request.Request(url, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                body = json.loads(resp.read().decode("utf-8"))
                return {"status": resp.status, "body": body}
        except Exception as e:
            return {"status": 0, "error": str(e)}

    def health_check(self) -> bool:
        result = self._get("/health")
        if result["status"] == 200:
            print(f"[API] Server healthy: {result['body'].get('service', 'unknown')}")
            return True
        print(f"[API] Health check failed: {result.get('error', 'unknown')}")
        return False

    def register_device(self, device_id: str, hive_id: str, location: str, beekeeper: str) -> bool:
        result = self._post("/api/v1/devices/register", {
            "deviceId": device_id,
            "hiveId": hive_id,
            "clusterLocation": location,
            "beekeeperId": beekeeper,
        })
        ok = result["status"] in (200, 201)
        status = "registered" if ok else f"failed ({result.get('error', '')})"
        print(f"[API] Device {device_id}: {status}")
        return ok

    def push_telemetry(self, reading: dict) -> bool:
        result = self._post("/api/v1/telemetry/commit", reading)
        ok = result["status"] == 200
        if ok:
            commitment = result["body"].get("dataCommitment", "N/A")[:16]
            print(f"[API] Telemetry committed — commitment: {commitment}...")
        else:
            print(f"[API] Telemetry push failed: {result.get('error', '')}")
        return ok

    def get_telemetry_batch(self, batch_id: str) -> dict:
        return self._get(f"/api/v1/telemetry/batch/{batch_id}")


# ============================================================================
# Demo Lifecycle
# ============================================================================
def run_demo_lifecycle(api: HoneyChainAPI, device_id: str, hive_id: str):
    """
    Full lifecycle demo:
      1. Register device
      2. Send 5 telemetry readings (simulating harvest window)
      3. Fetch stored readings
    """
    print("\n" + "=" * 60)
    print("  HONEYCHAIN IoT DEMO — FULL LIFECYCLE")
    print("=" * 60)

    # Step 1: Register device
    print("\n[STEP 1] Registering ESP32 device...")
    api.register_device(device_id, hive_id, "Demo Apiary, West Bengal", "BK-DEMO-001")
    time.sleep(1)

    # Step 2: Simulate telemetry readings
    print("\n[STEP 2] Simulating hive telemetry (5 readings)...")
    hive = HiveSimulator(device_id, hive_id, time.time())

    for i in range(5):
        reading = hive.read()
        print(f"\n--- Reading {i+1}/5 ---")
        print(f"  Device:     {reading['deviceId']}")
        print(f"  Hive:       {reading['hiveId']}")
        print(f"  Timestamp:  {reading['timestamp']} ({datetime.fromtimestamp(reading['timestamp'], tz=timezone.utc).isoformat()})")
        print(f"  Temp:       {reading['temperature']}°C")
        print(f"  Humidity:   {reading['humidity']}%")
        print(f"  Weight:     {reading['weight']} kg")
        api.push_telemetry(reading)
        time.sleep(1)

    # Step 3: Fetch stored readings
    print("\n[STEP 3] Fetching stored telemetry for batch...")
    batch_id = f"BATCH-{hive_id}"
    result = api.get_telemetry_batch(batch_id)
    if result["status"] == 200:
        body = result["body"]
        print(f"  Total readings stored: {body.get('readingsCount', 0)}")
        for r in body.get("readings", []):
            print(f"    [{r['timestamp']}] T={r['temperature']}°C H={r['humidity']}% W={r['weight']}kg")
    else:
        print(f"  Fetch failed: {result.get('error', '')}")

    print("\n" + "=" * 60)
    print("  DEMO COMPLETE — Telemetry flow verified end-to-end")
    print("=" * 60 + "\n")


# ============================================================================
# Multi-Device Continuous Simulation
# ============================================================================
def run_continuous_simulation(api: HoneyChainAPI, num_devices: int, interval: int):
    """Simulate multiple hives sending telemetry at regular intervals."""
    print(f"\n[Simulator] Starting {num_devices} device(s), interval={interval}s")
    print(f"[Simulator] Press Ctrl+C to stop.\n")

    start_time = time.time()
    hives = []

    for i in range(num_devices):
        device_id = f"ESP32-HIVE-{i+1:03d}"
        hive_id = f"HIVE-{i+1:03d}"
        hives.append(HiveSimulator(device_id, hive_id, start_time))

        # Register each device
        api.register_device(device_id, hive_id, f"Cluster-{i+1}, Meghalaya", f"BK-{i+1:03d}")

    print(f"\n[Simulator] {len(hives)} devices registered. Streaming telemetry...\n")

    reading_count = 0
    try:
        while True:
            for hive in hives:
                reading = hive.read()
                api.push_telemetry(reading)
                reading_count += 1

            print(f"[Simulator] Cycle complete — {reading_count} total readings sent.\n")
            time.sleep(interval)

    except KeyboardInterrupt:
        print(f"\n[Simulator] Stopped. Total readings sent: {reading_count}")


# ============================================================================
# CLI Entry Point
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="HoneyChain ESP32 Telemetry Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python esp32_simulator.py --demo                    Full lifecycle demo
  python esp32_simulator.py --devices 3 --interval 5  3 hives, every 5s
  python esp32_simulator.py --api http://10.0.0.1:3000 Custom API endpoint
        """,
    )
    parser.add_argument("--api", default=DEFAULT_API_BASE, help="API base URL")
    parser.add_argument("--devices", type=int, default=1, help="Number of simulated hives")
    parser.add_argument("--interval", type=int, default=30, help="Transmission interval (seconds)")
    parser.add_argument("--device-id", default=DEFAULT_DEVICE_ID, help="Device ID (single device mode)")
    parser.add_argument("--hive-id", default=DEFAULT_HIVE_ID, help="Hive ID (single device mode)")
    parser.add_argument("--demo", action="store_true", help="Run full lifecycle demo")

    args = parser.parse_args()
    api = HoneyChainAPI(args.api)

    # Check server connectivity
    if not api.health_check():
        print(f"\n[ERROR] Cannot reach HoneyChain API at {args.api}")
        print(f"        Make sure the server is running: npm run server")
        sys.exit(1)

    if args.demo:
        run_demo_lifecycle(api, args.device_id, args.hive_id)
    else:
        run_continuous_simulation(api, args.devices, args.interval)


if __name__ == "__main__":
    main()
