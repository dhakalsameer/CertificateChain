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
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

const provider = new ethers.JsonRpcProvider(RPC_URL);
const registry = new ethers.Contract(REGISTRY_ADDRESS, REGISTRY_ABI, provider);
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

const fromBlock = 0;
const toBlock = "latest";

console.log("Fetching Transfer events...");
const filter = sameer.filters.Transfer(ethers.ZeroAddress);
const events = await sameer.queryFilter(filter, fromBlock, toBlock);
console.log(`Found ${events.length} mint events`);

const existing = loadDb();
const existingHashes = new Set(existing.map((c) => c.certificateHash));
let synced = 0;

for (const event of events) {
  try {
    const tokenId = event.args[2];
    const certHash = await sameer.certificateHash(tokenId);
    if (existingHashes.has(certHash)) continue;

    const cert = await registry.getCertificate(certHash);
    const studentAddr = event.args[1];

    existing.push({
      id: String(Date.now() + synced),
      tokenId: String(tokenId),
      studentName: cert.studentName,
      regNo: cert.registrationNumber,
      course: cert.course,
      grade: cert.grade,
      certificateHash: cert.certificateHash,
      ipfsHash: cert.ipfsHash,
      studentAddress: studentAddr.toLowerCase(),
      nftMinted: true,
      issuedAt: Number(cert.issuedAt) * 1000,
    });
    existingHashes.add(certHash);
    synced++;
    console.log(`  Synced #${tokenId}: ${cert.studentName} — ${cert.course}`);
  } catch (err) {
    console.error(`  Error:`, err.message);
  }
}

saveDb(existing);
console.log(`\nDone. Synced ${synced} new certificates (${existing.length} total).`);
