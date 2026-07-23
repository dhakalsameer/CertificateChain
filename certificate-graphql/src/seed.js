import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, "..", "data.json");

const RPC_URL = process.env.RPC_URL;
const REGISTRY_ADDRESS = process.env.REGISTRY_ADDRESS || "0x871086DA3fA39378DDaaae6c2CA79ec1bac5a92C";
const SAMEER_ADDRESS = process.env.SAMEER_ADDRESS || "0x3ff7bF2CC03fa79eFd17F19FeeE03Dc0E0973dcA";

if (!RPC_URL) {
  console.error("RPC_URL is required. Set it in .env");
  process.exit(1);
}

const REGISTRY_ABI = [
  "function getCertificate(string calldata _certificateHash) view returns (tuple(string studentName, string registrationNumber, string course, string grade, string certificateHash, string ipfsHash, uint256 issuedAt, address issuer, bool revoked))",
];

const SAMEER_ABI = [
  "function certificateHash(uint256 tokenId) view returns (string)",
  "function minted(string calldata certHash) view returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const REGISTRY_EVENTS_ABI = [
  "event CertificateIssued(string certificateHash, string ipfsHash, address issuer)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const registry = new ethers.Contract(REGISTRY_ADDRESS, [...REGISTRY_ABI, ...REGISTRY_EVENTS_ABI], provider);
const sameer = new ethers.Contract(SAMEER_ADDRESS, SAMEER_ABI, provider);

function loadDb() {
  if (!existsSync(DB_PATH)) return [];
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function saveDb(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const cur = await provider.getBlockNumber();
const FROM_BLOCK = 11071000;
const BATCH = 10;

console.log(`Scanning Registry events from block ${FROM_BLOCK} to ${cur}...`);

const existing = loadDb();
const existingHashes = new Set(existing.map((c) => c.certificateHash));
let synced = 0;

for (let from = FROM_BLOCK; from <= cur; from += BATCH) {
  const to = Math.min(from + BATCH - 1, cur);
  try {
    const events = await registry.queryFilter(registry.filters.CertificateIssued(), from, to);
    if (events.length === 0) continue;

    for (const event of events) {
      try {
        const [certHash, ipfsHash, issuer] = [event.args[0], event.args[1], event.args[2]];
        if (existingHashes.has(certHash)) continue;

        const cert = await registry.getCertificate(certHash);
        const nftMinted = await sameer.minted(certHash);

        existing.push({
          id: String(Date.now() + synced),
          tokenId: "0",
          studentName: cert.studentName,
          regNo: cert.registrationNumber,
          course: cert.course,
          grade: cert.grade,
          certificateHash: cert.certificateHash,
          ipfsHash: cert.ipfsHash,
          studentAddress: "",
          nftMinted,
          issuedAt: Number(cert.issuedAt) * 1000,
        });
        existingHashes.add(certHash);
        synced++;
        console.log(`  #${synced}: ${cert.studentName} — ${cert.course}`);
      } catch (err) {
        console.error(`  Error on cert:`, err.message);
      }
    }
  } catch {
    // skip ranges with errors (archive data not available)
  }

  if ((from - FROM_BLOCK) % 500 === 0) {
    process.stdout.write(`\r  scanned to block ${to}...`);
  }
}

// Also scan Sameer Transfer events for token IDs and student addresses
console.log("\n\nScanning Sameer Transfer events...");
const transferFilter = sameer.filters.Transfer(ethers.ZeroAddress);
for (let from = FROM_BLOCK; from <= cur; from += BATCH) {
  const to = Math.min(from + BATCH - 1, cur);
  try {
    const events = await sameer.queryFilter(transferFilter, from, to);
    for (const event of events) {
      const tokenId = event.args[2].toString();
      const studentAddr = event.args[1].toLowerCase();
      try {
        const certHash = await sameer.certificateHash(tokenId);
        const certEntry = existing.find((c) => c.certificateHash === certHash);
        if (certEntry) {
          certEntry.tokenId = tokenId;
          certEntry.studentAddress = studentAddr;
          certEntry.nftMinted = true;
        }
      } catch {}
    }
  } catch {}

  if ((from - FROM_BLOCK) % 500 === 0) {
    process.stdout.write(`\r  scanned to block ${to}...`);
  }
}

saveDb(existing);
console.log(`\n\nDone. Synced ${synced} certificates (${existing.length} total).`);
