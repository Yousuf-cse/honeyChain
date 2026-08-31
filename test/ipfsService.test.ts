import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IPFSService } from "../onchain/services/ipfsService.js";

describe("IPFS / Pinata Storage Service", function () {
  const service = new IPFSService();

  it("should upload JSON metadata and return valid IPFS URI and CID", async function () {
    const data = {
      name: "Honey Batch #1",
      description: "Organic honey test batch",
      attributes: [{ trait_type: "Moisture", value: 17.5 }],
    };

    const res = await service.uploadJSON(data);

    assert.ok(res.cid);
    assert.ok(res.ipfsUri.startsWith("ipfs://"));
    assert.ok(res.gatewayUrl.includes(res.cid));
    assert.ok(res.size > 0);
  });

  it("should upload document buffer and return IPFS URI", async function () {
    const mockPdfBuffer = Buffer.from("%PDF-1.4 Mock NABL Lab Certificate Content");
    const res = await service.uploadDocument(mockPdfBuffer, "nabl-report-001.pdf");

    assert.ok(res.cid);
    assert.ok(res.ipfsUri.startsWith("ipfs://"));
    assert.equal(res.size, mockPdfBuffer.length);
  });

  it("should format standard HoneyChain ERC-721 metadata with NABL reports", function () {
    const metadata = service.constructMetadataSchema({
      batchId: "HONEY-2026-NIL-001",
      hiveId: "HIVE-101",
      beekeeperId: "BK-42",
      clusterLocation: "Nilgiris Cluster",
      harvestDate: "2026-08-15",
      floralSource: "Wild Multifloral",
      telemetryCommitment: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      nablReport: {
        labName: "NABL National Honey Testing Lab",
        accreditationNumber: "NABL-9981",
        testDate: "2026-08-18",
        moisturePercentage: 17.8,
        fructoseGlucoseRatio: 1.22,
        sucrosePercentage: 1.9,
        hmfContent: 10.5,
        pollenAnalysis: "Multifloral",
        adulterationDetected: false,
        status: "PASSED",
      },
    });

    assert.equal(metadata.name, "HoneyChain Batch #HONEY-2026-NIL-001");
    assert.equal(metadata.honeyChain.batchId, "HONEY-2026-NIL-001");
    assert.equal(metadata.honeyChain.nablReport?.status, "PASSED");
    assert.equal(metadata.attributes.find((a) => a.trait_type === "Moisture %")?.value, 17.8);
    assert.equal(metadata.attributes.find((a) => a.trait_type === "Adulteration Free")?.value, true);
  });
});
