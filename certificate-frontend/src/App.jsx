import { useState, useEffect } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";

import registryJson from "./abi/CertificateRegistry.json";
import sameerJson from "./abi/Sameer.json";
import { generateFileHash, generateCertificateHash } from "./utils/hash";
import { uploadFileToPinata } from "./utils/pinata";

const REGISTRY_ADDRESS = "0x4445E3602efd43224baf9CD7855e5400B3d5e8Ae";
const SAMEER_ADDRESS = "0x84385B1a61dF065eb558fD95374f44EE21509aF2";

const REGISTRY_ABI = registryJson.abi || registryJson;
const SAMEER_ABI = sameerJson.abi || sameerJson;

const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4000/graphql";
const RPC_URL = import.meta.env.VITE_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/alch_N1z03oA4LzVxngax--cjz";

function toBytes32(hex) {
  return hex?.startsWith("0x") ? hex : "0x" + hex;
}

async function gql(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function TrimmedAddr({ addr }) {
  return <>{addr.slice(0, 6)}...{addr.slice(-4)}</>;
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
      <path d="M12 3L4 7v5c0 5.25 3.83 10.08 8 11 4.17-.92 8-5.75 8-11V7l-8-4z" fill="currentColor" opacity="0.2"/>
      <path d="M12 3L4 7v5c0 5.25 3.83 10.08 8 11V3z" fill="url(#brand)" opacity="0.4"/>
      <path d="M12 3L4 7v5c0 5.25 3.83 10.08 8 11 4.17-.92 8-5.75 8-11V7l-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconCopy({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`w-3.5 h-3.5 ${className}`}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function App() {
  const [account, setAccount] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [mounted, setMounted] = useState(false);

  const [form, setForm] = useState({
    studentName: "", regNo: "", course: "", grade: "", studentAddress: "",
  });

  const [issueFile, setIssueFile] = useState(null);
  const [issueHash, setIssueHash] = useState("");
  const [verifyFile, setVerifyFile] = useState(null);
  const [generatedVerifyHash, setGeneratedVerifyHash] = useState("");

  const [verifyHash, setVerifyHash] = useState("");
  const [result, setResult] = useState("");
  const [certificateData, setCertificateData] = useState(null);
  const [issued, setIssued] = useState(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [myCertificates, setMyCertificates] = useState([]);
  const [isLoadingMyCerts, setIsLoadingMyCerts] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [copied, setCopied] = useState(false);
  const [allCertificates, setAllCertificates] = useState([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [adminTab, setAdminTab] = useState("issue");
  const [revokeHash, setRevokeHash] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [newAdminAddr, setNewAdminAddr] = useState("");
  const [removeAdminAddr, setRemoveAdminAddr] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isRemovingAdmin, setIsRemovingAdmin] = useState(false);
  const [contractStats, setContractStats] = useState(null);
  const [adminMsg, setAdminMsg] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (issueFile) {
      generateFileHash(issueFile).then(setIssueHash);
    } else {
      setIssueHash("");
    }
  }, [issueFile]);

  useEffect(() => {
    if (verifyFile) {
      generateFileHash(verifyFile).then(setGeneratedVerifyHash);
    } else {
      setGeneratedVerifyHash("");
    }
  }, [verifyFile]);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
        if (accounts.length > 0) {
          const acc = accounts[0];
          setAccount(acc);
          checkAdminStatus(acc);
          fetchMyCertificates(acc);
        }
      });

      window.ethereum.on("accountsChanged", (accounts) => {
        const newAccount = accounts[0] || "";
        setAccount(newAccount);
        if (newAccount) {
          checkAdminStatus(newAccount);
          fetchMyCertificates(newAccount);
        } else {
          setIsAdmin(false);
          setMyCertificates([]);
          setActiveTab("all");
          fetchAllCertificates();
        }
      });
    }
  }, []);

  useEffect(() => {
    fetchAllCertificates();
  }, []);

  const fetchAllCertificates = async () => {
    try {
      setIsLoadingAll(true);
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const count = await registry.getCertificatesCount();
      if (count === 0n) { setAllCertificates([]); return; }
      const certs = await registry.getCertificates(0, count > 100n ? 100n : count);
      setAllCertificates(certs.map((c, i) => ({
        id: String(i),
        tokenId: "0",
        studentName: c.studentName,
        regNo: c.registrationNumber,
        course: c.course,
        grade: c.grade,
        certificateHash: c.certificateHash,
        ipfsHash: c.ipfsHash,
        studentAddress: c.issuer,
        nftMinted: false,
        issuedAt: Number(c.issuedAt) * 1000,
      })));
    } catch (err) {
      console.log("Chain read failed:", err);
      setAllCertificates([]);
    } finally {
      setIsLoadingAll(false);
    }
  };

  const syncCertificateToGraphql = async (tokenId, formData, certHash, ipfsHash, nftSuccess) => {
    try {
      await gql(`
        mutation($input: CertificateInput!) {
          addCertificate(input: $input) { id }
        }
      `, {
        input: {
          tokenId: String(tokenId || "0"),
          studentName: formData.studentName,
          regNo: formData.regNo,
          course: formData.course,
          grade: formData.grade,
          certificateHash: certHash,
          ipfsHash: ipfsHash,
          studentAddress: formData.studentAddress.toLowerCase(),
          nftMinted: nftSuccess,
          issuedAt: Date.now(),
        },
      });
      fetchAllCertificates();
    } catch (err) {
      console.log("GraphQL sync skipped (server may be offline)");
    }
  };

  const fetchMyCertificates = async (userAddr) => {
    if (!userAddr) return;
    try {
      setIsLoadingMyCerts(true);
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const sameer = await getContract(SAMEER_ADDRESS, SAMEER_ABI);

      const filter = sameer.filters.Transfer(null, userAddr);
      const currentBlock = await sameer.runner?.provider?.getBlockNumber?.() || 99999999;
      const DEPLOY_BLOCK = 11086326;
      const BATCH = 9000;
      let allEvents = [];
      for (let from = DEPLOY_BLOCK; from <= currentBlock; from += BATCH) {
        const to = Math.min(from + BATCH - 1, currentBlock);
        try {
          const batch = await sameer.queryFilter(filter, from, to);
          allEvents = allEvents.concat(batch);
        } catch {}
      }
      const events = allEvents;

      const certs = await Promise.all(
        events.map(async (event) => {
          const tokenId = event.args[2];
          const certHash = await sameer.certificateHash(tokenId);
          const cert = await registry.getCertificate(certHash);
          return {
            tokenId: tokenId.toString(),
            studentName: cert.studentName,
            regNo: cert.registrationNumber,
            course: cert.course,
            grade: cert.grade,
            certificateHash: cert.certificateHash,
            ipfsHash: cert.ipfsHash,
            issuedAt: Number(cert.issuedAt) * 1000
          };
        })
      );

      setMyCertificates(certs.sort((a, b) => b.issuedAt - a.issuedAt));
    } catch (err) {
      console.error("Error fetching my certificates:", err);
    } finally {
      setIsLoadingMyCerts(false);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const checkAdminStatus = async (addr) => {
    try {
      const contract = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);

      let status = false;
      try {
        status = await contract.isAdmin(addr);
      } catch (e) {
        try {
          status = await contract.admins(addr);
        } catch (e2) {
          console.error("Admin check failed");
        }
      }

      setIsAdmin(!!status);
      if (status) fetchContractStats();
    } catch (err) {
      console.error("Admin Check Error:", err);
      setIsAdmin(false);
    }
  };

  const fetchContractStats = async () => {
    try {
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const [total, admins, revoked] = await Promise.all([
        registry.totalCertificates(),
        registry.totalAdmins(),
        registry.totalRevokedCertificates(),
      ]);
      setContractStats({ total: total.toString(), admins: admins.toString(), revoked: revoked.toString() });
    } catch { setContractStats(null); }
  };

  const actRevoke = async () => {
    if (!revokeHash) return;
    setIsRevoking(true);
    setAdminMsg(null);
    try {
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const tx = await registry.revokeCertificate(toBytes32(revokeHash));
      await tx.wait();
      setAdminMsg({ type: "success", text: "Certificate revoked on-chain" });
      setRevokeHash("");
      fetchContractStats();
      fetchAllCertificates();
    } catch (err) {
      setAdminMsg({ type: "error", text: err?.reason || err?.message || "Revoke failed" });
    }
    setIsRevoking(false);
  };

  const actAddAdmin = async () => {
    if (!ethers.isAddress(newAdminAddr)) { setAdminMsg({ type: "error", text: "Invalid address" }); return; }
    setIsAddingAdmin(true);
    setAdminMsg(null);
    try {
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const tx = await registry.addAdmin(newAdminAddr);
      await tx.wait();
      setAdminMsg({ type: "success", text: `Admin added: ${newAdminAddr.slice(0, 6)}...` });
      setNewAdminAddr("");
      fetchContractStats();
    } catch (err) {
      setAdminMsg({ type: "error", text: err?.reason || err?.message || "Failed to add admin" });
    }
    setIsAddingAdmin(false);
  };

  const actRemoveAdmin = async () => {
    if (!ethers.isAddress(removeAdminAddr)) { setAdminMsg({ type: "error", text: "Invalid address" }); return; }
    setIsRemovingAdmin(true);
    setAdminMsg(null);
    try {
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const tx = await registry.removeAdmin(removeAdminAddr);
      await tx.wait();
      setAdminMsg({ type: "success", text: `Admin removed: ${removeAdminAddr.slice(0, 6)}...` });
      setRemoveAdminAddr("");
      fetchContractStats();
    } catch (err) {
      setAdminMsg({ type: "error", text: err?.reason || err?.message || "Failed to remove admin" });
    }
    setIsRemovingAdmin(false);
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        alert("Please install MetaMask!");
        return;
      }
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      setAccount(accounts[0]);
      await checkAdminStatus(accounts[0]);
      await fetchMyCertificates(accounts[0]);
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const getContract = async (address, abi) => {
    if (window.ethereum && account) {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return new Contract(address, abi, signer);
    }
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    return new Contract(address, abi, provider);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const issueCertificate = async () => {
    try {
      if (!form.studentName || !form.regNo || !form.course || !form.grade || !form.studentAddress || !issueFile) {
        alert("Please fill all fields and upload a file");
        return;
      }

      if (!ethers.isAddress(form.studentAddress)) {
        alert("Invalid student wallet address");
        return;
      }

      setIsIssuing(true);
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const sameer = await getContract(SAMEER_ADDRESS, SAMEER_ABI);

      const fileHash = issueHash || await generateFileHash(issueFile);
      const certHash = generateCertificateHash({ ...form, fileHash });
      const certHashB = toBytes32(certHash);
      const ipfsHash = await uploadFileToPinata(issueFile, {
        name: `Cert: ${form.studentName}`,
        keyvalues: { student: form.studentName, reg: form.regNo }
      });

      const tx1 = await registry.issueCertificate(
        form.studentName, form.regNo, form.course, form.grade, certHashB, ipfsHash
      );
      await tx1.wait();

      let nftSuccess = false;
      let tokenId = "0";
      try {
        const tx2 = await sameer.mintCertificateNFT(form.studentAddress, certHashB);
        const receipt = await tx2.wait();
        const transferLog = receipt.logs.find(l => l.topics[0] === sameer.interface.getEvent("Transfer").topicHash);
        if (transferLog) {
          tokenId = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], transferLog.topics[3])[0].toString();
        }
        nftSuccess = true;
      } catch (nftErr) {
        console.error("NFT Minting failed:", nftErr);
      }

      setIssued({ certHash, ipfsHash, nftSuccess });
      syncCertificateToGraphql(tokenId, form, certHash, ipfsHash, nftSuccess);
      fetchContractStats();
      setAdminTab("credentials");
      setForm({ studentName: "", regNo: "", course: "", grade: "", studentAddress: "" });
      setIssueFile(null);
      setIssueHash("");
      fetchMyCertificates(account);
    } catch (err) {
      console.error("Issuance Error:", err);
      alert(err?.reason || err?.message || "Transaction Failed");
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    try {
      let hashToVerify = verifyHash;
      if (verifyFile) {
        setIsVerifying(true);
        hashToVerify = generatedVerifyHash || await generateFileHash(verifyFile);
      }

      if (!hashToVerify) {
        alert("Please enter a hash or upload a file");
        return;
      }

      setIsVerifying(true);
      const registry = await getContract(REGISTRY_ADDRESS, REGISTRY_ABI);
      const sameer = await getContract(SAMEER_ADDRESS, SAMEER_ABI);

      const hashB = toBytes32(hashToVerify);
      const valid = await registry.verifyCertificate(hashB);

      if (!valid) {
        setResult("INVALID");
        setCertificateData(null);
        return;
      }

      const cert = await registry.getCertificate(hashB);
      const nftMinted = await sameer.minted(hashB);

      setCertificateData({
        studentName: cert.studentName,
        regNo: cert.registrationNumber,
        course: cert.course,
        grade: cert.grade,
        certificateHash: cert.certificateHash,
        ipfsHash: cert.ipfsHash,
        nftStatus: nftMinted ? "MINTED" : "NOT MINTED"
      });
      setResult("VALID");
    } catch (err) {
      console.error(err);
      setResult("NOT_FOUND");
      setCertificateData(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-brand-500 border-t-transparent animate-spin-slow" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)' }}>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: theme === 'dark' ? 0.03 : 0.02 }}>
        <defs>
          <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <radialGradient id="orb1" cx="20%" cy="30%" r="50%">
            <stop offset="0%" stopColor="#a855f7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="orb2" cx="80%" cy="70%" r="50%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <div className="glow-orb w-[600px] h-[600px] -top-48 -left-48" style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.12) 0%, transparent 70%)' }} />
      <div className="glow-orb w-[500px] h-[500px] -bottom-32 -right-32" style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)' }} />

      <nav className="sticky top-0 z-50" style={{ background: 'var(--surface)', borderBottom: '1px solid var(--card-border)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <IconShield />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                CredVerify
              </span>
              <span className="text-[10px] font-medium ml-2 px-2 py-0.5 rounded-full" style={{ background: 'var(--card)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' }}>
                Sepolia
              </span>
            </div>
            {account && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold ${
                isAdmin
                  ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-purple-500 animate-pulse-soft' : 'bg-zinc-400'}`} />
                {isAdmin ? "Admin" : "Verified"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
              {(() => {
                const tabs = ["all", "verify"];
                if (account) tabs.push("mycerts");
                return tabs;
              })().map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                      : 'hover:text-purple-500 dark:hover:text-purple-400'
                  }`}
                  style={{ color: activeTab === tab ? 'white' : 'var(--text-secondary)' }}
                >
                  {tab === "all" ? `All Credentials${allCertificates.length > 0 ? ` (${allCertificates.length})` : ""}` :
                   tab === "verify" ? "Verify" :
                   `My Credentials${myCertificates.length > 0 ? ` (${myCertificates.length})` : ""}`}
                </button>
              ))}
            </div>

            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:scale-105"
              style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}
            >
              {theme === "light" ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <circle cx="12" cy="12" r="5"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            <button
              onClick={connectWallet}
              className={`h-9 px-4 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 ${
                account
                  ? 'border'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30'
              }`}
              style={account ? { background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' } : {}}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${account ? 'bg-green-500 animate-pulse-soft' : 'bg-white/60'}`} />
              <span className="hidden sm:inline">
                {account ? <TrimmedAddr addr={account} /> : "Connect Wallet"}
              </span>
              <span className="sm:hidden">{account ? "Connected" : "Connect"}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-10 pb-20 relative z-10">
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-4" style={{ background: 'var(--card)', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-soft" />
            Ethereum Sepolia
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3" style={{ color: 'var(--text-primary)' }}>
            Immutable Academic Credentials
          </h1>
          <p className="text-sm sm:text-base max-w-lg mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Issue, verify, and own blockchain-secured certificates powered by Ethereum & IPFS.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {activeTab === "all" && (
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 9h18M9 21V9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Issued Certificates</h2>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>All blockchain-verified credentials</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {isLoadingAll ? (
                    <div className="card-elevated p-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin-slow" />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Loading certificates...</p>
                    </div>
                  ) : allCertificates.length > 0 ? (
                    allCertificates.map((cert, i) => (
                      <div
                        key={cert.id}
                        className="card-elevated p-5 animate-slide-up cursor-pointer transition-all hover:shadow-md"
                        style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                        onClick={() => setExpandedId(expandedId === cert.id ? null : cert.id)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base font-bold">{cert.course}</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {cert.studentName} &middot; {cert.regNo}
                            </p>
                          </div>
                          <span className="shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            #{cert.tokenId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setVerifyHash(cert.certificateHash); setVerifyFile(null); setGeneratedVerifyHash(""); setResult(""); setCertificateData(null); setActiveTab("verify"); }}
                              className="text-xs font-semibold inline-flex items-center gap-1 hover:text-emerald-500 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              Verify
                            </button>
                            <a
                              href={`https://sepolia.etherscan.io/token/${SAMEER_ADDRESS}?a=${cert.tokenId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold inline-flex items-center gap-1 hover:text-purple-500 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              Explorer <IconExternal />
                            </a>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${cert.ipfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold inline-flex items-center gap-1 hover:text-green-500 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              IPFS <IconExternal />
                            </a>
                          </div>
                        </div>
                        {expandedId === cert.id && (
                          <div className="mt-4 pt-4 animate-slide-up" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Grade</p>
                                <p style={{ color: 'var(--text-primary)' }}>{cert.grade}</p>
                              </div>
                              <div>
                                <p className="font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>Issuer</p>
                                <p className="font-mono truncate" style={{ color: 'var(--text-secondary)' }}>{cert.studentAddress}</p>
                              </div>
                            </div>
                            <div className="mt-3 p-3 rounded-lg text-xs font-mono break-all" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                              <p className="font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Certificate Hash</p>
                              <p style={{ color: 'var(--text-secondary)' }}>{cert.certificateHash}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="card-elevated p-12 text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--card)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7" style={{ color: 'var(--text-muted)' }}>
                          <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold mb-1">No certificates issued yet</h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Certificates will appear here once they are issued on-chain.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="card-elevated p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path d="M12 3L4 7v5c0 5.25 3.83 10.08 8 11 4.17-.92 8-5.75 8-11V7l-8-4z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Admin Panel</h2>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Manage credentials and contract</p>
                  </div>
                </div>

                {contractStats && (
                  <div className="flex gap-3 mb-6 text-xs flex-wrap">
                    <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                      Total: <span className="text-purple-600 dark:text-purple-400">{contractStats.total}</span>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                      Admins: <span className="text-purple-600 dark:text-purple-400">{contractStats.admins}</span>
                    </span>
                    <span className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                      Revoked: <span className="text-red-500">{contractStats.revoked}</span>
                    </span>
                  </div>
                )}

                <div className="flex gap-1 p-1 mb-6 rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                  {[
                    { key: "credentials", label: "All Credentials" },
                    { key: "issue", label: "Issue" },
                    { key: "revoke", label: "Revoke" },
                    { key: "admins", label: "Admins" },
                  ].map(t => (
                    <button key={t.key} onClick={() => { setAdminTab(t.key); setAdminMsg(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        adminTab === t.key
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                          : 'hover:text-purple-500'
                      }`}
                      style={{ color: adminTab === t.key ? 'white' : 'var(--text-secondary)' }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {adminMsg && (
                  <div className={`mb-4 p-3 rounded-xl text-xs font-semibold animate-slide-up ${
                    adminMsg.type === "success" ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                  }`} style={{
                    background: adminMsg.type === "success" ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${adminMsg.type === "success" ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`
                  }}>
                    {adminMsg.text}
                  </div>
                )}

                {adminTab === "credentials" && (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {allCertificates.length > 0 ? (
                      allCertificates.map((cert, i) => (
                        <div key={cert.id} className="p-4 rounded-xl animate-slide-up" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-sm font-bold">{cert.studentName}</h3>
                              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{cert.course} &middot; {cert.regNo}</p>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400">
                              #{cert.tokenId}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                              {new Date(cert.issuedAt).toLocaleDateString()}
                            </span>
                            <a href={`https://sepolia.etherscan.io/token/${SAMEER_ADDRESS}?a=${cert.tokenId}`} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline">
                              Explorer
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>No certificates in database</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Issue one to see it appear here</p>
                      </div>
                    )}
                  </div>
                )}

                {adminTab === "issue" && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      {[
                        { label: "Student Name", name: "studentName", placeholder: "e.g. Sameer Dhakal" },
                        { label: "Registration ID", name: "regNo", placeholder: "e.g. GUST3030" },
                        { label: "Course Title", name: "course", placeholder: "e.g. BSc.CSIT" },
                        { label: "Grade", name: "grade", placeholder: "e.g. B+" },
                        { label: "Student Wallet", name: "studentAddress", placeholder: "0x..." }
                      ].map((field) => (
                        <div key={field.name} className={`space-y-1 ${field.name === "studentAddress" ? "sm:col-span-2" : ""}`}>
                          <label className="label">{field.label}</label>
                          <input name={field.name} value={form[field.name]} onChange={handleChange} placeholder={field.placeholder} className="input" />
                        </div>
                      ))}
                    </div>

                    <div className="mb-6">
                      <label className="label mb-2">Certificate Document</label>
                      <div className="relative group">
                        <input type="file" onChange={(e) => setIssueFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                        <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed transition-all group-hover:border-purple-400 group-hover:bg-purple-500/5" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }}>
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--card)' }}>
                            <IconUpload />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{issueFile ? issueFile.name : "Choose a file or drag here"}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PDF, PNG, JPG up to 10MB</p>
                          </div>
                          {issueFile && (
                            <button onClick={(e) => { e.stopPropagation(); setIssueFile(null); }} className="text-xs font-semibold px-3 py-1 rounded-lg hover:bg-red-500/10" style={{ color: '#ef4444' }}>Remove</button>
                          )}
                        </div>
                      </div>
                      {issueHash && (
                        <div className="mt-3 flex items-center gap-2 p-3 rounded-lg text-xs font-mono" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                          <span className="font-medium" style={{ color: 'var(--text-muted)' }}>SHA-256:</span>
                          <span className="truncate" style={{ color: 'var(--text-secondary)' }}>{issueHash}</span>
                          <button onClick={() => copyToClipboard(issueHash)} className="shrink-0 hover:text-purple-500 transition-colors" style={{ color: 'var(--text-muted)' }}>
                            {copied ? <span className="text-green-500 text-xs font-medium">Copied!</span> : <IconCopy />}
                          </button>
                        </div>
                      )}
                    </div>

                    <button onClick={issueCertificate} disabled={isIssuing} className="btn btn-primary w-full h-12">
                      {isIssuing ? (
                        <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processing...</>
                      ) : "Issue & Mint NFT"}
                    </button>

                    {issued && (
                      <div className="mt-4 p-4 rounded-xl animate-slide-up" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white"><IconCheck /></div>
                          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {issued.nftSuccess ? "Certificate Issued & NFT Minted" : "Certificate Issued"}
                          </span>
                        </div>
                        <div className="text-xs font-mono break-all opacity-70 mb-2" style={{ color: 'var(--text-secondary)' }}>{issued.certHash}</div>
                        <a href={`https://gateway.pinata.cloud/ipfs/${issued.ipfsHash}`} target="_blank" rel="noreferrer" className="text-xs font-semibold inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline">
                          View on IPFS <IconExternal />
                        </a>
                      </div>
                    )}
                  </>
                )}

                {adminTab === "revoke" && (
                  <div className="space-y-4">
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Enter the certificate hash to revoke it on-chain.</p>
                    <input value={revokeHash} onChange={(e) => setRevokeHash(e.target.value)} placeholder="0x... certificate hash" className="input" />
                    <button onClick={actRevoke} disabled={isRevoking} className="btn btn-primary w-full h-12" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                      {isRevoking ? (
                        <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Revoking...</>
                      ) : "Revoke Certificate"}
                    </button>
                  </div>
                )}

                {adminTab === "admins" && (
                  <div className="space-y-6">
                    <div>
                      <label className="label mb-2">Add Admin</label>
                      <div className="flex gap-2">
                        <input value={newAdminAddr} onChange={(e) => setNewAdminAddr(e.target.value)} placeholder="0x... wallet address" className="input flex-1" />
                        <button onClick={actAddAdmin} disabled={isAddingAdmin} className="btn btn-primary shrink-0">
                          {isAddingAdmin ? "Adding..." : "Add"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="label mb-2">Remove Admin</label>
                      <div className="flex gap-2">
                        <input value={removeAdminAddr} onChange={(e) => setRemoveAdminAddr(e.target.value)} placeholder="0x... wallet address" className="input flex-1" />
                        <button onClick={actRemoveAdmin} disabled={isRemovingAdmin} className="btn btn-primary shrink-0" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
                          {isRemovingAdmin ? "Removing..." : "Remove"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {account && activeTab === "mycerts" && (
              <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 9h18M9 21V9" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">My Credentials</h2>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your soulbound certificate collection</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {isLoadingMyCerts ? (
                    <div className="card-elevated p-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin-slow" />
                      <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Scanning blockchain...</p>
                    </div>
                  ) : myCertificates.length > 0 ? (
                    myCertificates.map((cert, i) => (
                      <div
                        key={cert.tokenId}
                        className="card-elevated p-5 animate-slide-up"
                        style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-base font-bold">{cert.course}</h3>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                              {cert.studentName} &middot; {cert.regNo}
                            </p>
                          </div>
                          <span className="shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold bg-gradient-to-r from-purple-500/10 to-pink-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            #{cert.tokenId}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(cert.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                          <div className="flex gap-3">
                            <a
                              href={`https://sepolia.etherscan.io/token/${SAMEER_ADDRESS}?a=${cert.tokenId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold inline-flex items-center gap-1 hover:text-purple-500 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              Explorer <IconExternal />
                            </a>
                            <a
                              href={`https://gateway.pinata.cloud/ipfs/${cert.ipfsHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold inline-flex items-center gap-1 hover:text-green-500 transition-colors"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              IPFS <IconExternal />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="card-elevated p-12 text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--card)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7" style={{ color: 'var(--text-muted)' }}>
                          <path d="M12 15v2m0 0v2m0-2h2m-2 0H10m21-12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                      <h3 className="text-base font-semibold mb-1">No credentials yet</h3>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Connect your wallet to view your soulbound certificates.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isAdmin && activeTab === "verify" && (
              <div className="card-elevated p-8 sm:p-10 min-h-[300px] flex items-center justify-center text-center animate-fade-in">
                <div className="max-w-xs">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'var(--card)' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8" style={{ color: 'var(--text-muted)' }}>
                      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold mb-2">Verification Portal</h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Upload a certificate or enter its hash to verify authenticity on-chain.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="card-elevated p-6 sm:p-8 animate-slide-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                    <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold">Verify Certificate</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>On-chain authenticity check</p>
                </div>
              </div>

              <div className="space-y-5">
                <div className="relative group">
                  <label className="label mb-2">Upload file to verify</label>
                  <input
                    type="file"
                    onChange={(e) => { setVerifyFile(e.target.files[0]); setVerifyHash(""); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed transition-all group-hover:border-purple-400 group-hover:bg-purple-500/5" style={{ borderColor: 'var(--input-border)', background: 'var(--input-bg)' }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--card)' }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6" style={{ color: 'var(--text-muted)' }}>
                        <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {verifyFile ? verifyFile.name : "Drop file or click to browse"}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hash computed client-side</p>
                    </div>
                    {verifyFile && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setVerifyFile(null); }}
                        className="text-xs font-semibold px-3 py-1 rounded-lg hover:bg-red-500/10"
                        style={{ color: '#ef4444' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {generatedVerifyHash && (
                    <div className="mt-2 text-xs font-mono truncate px-1" style={{ color: 'var(--text-muted)' }}>
                      Hash: {generatedVerifyHash}
                    </div>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full" style={{ borderTop: '1px solid var(--card-border)' }} />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-3 text-xs font-medium" style={{ background: 'var(--bg)', color: 'var(--text-muted)' }}>or</span>
                  </div>
                </div>

                <div>
                  <label className="label mb-2">Enter SHA-256 hash</label>
                  <input
                    value={verifyHash}
                    onChange={(e) => { setVerifyHash(e.target.value); setVerifyFile(null); setGeneratedVerifyHash(""); }}
                    placeholder="Paste the certificate hash..."
                    className="input"
                  />
                </div>

                <button
                  onClick={verifyCertificate}
                  disabled={isVerifying}
                  className="btn btn-primary w-full h-12"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Scanning Blockchain...
                    </>
                  ) : (
                    "Verify Authenticity"
                  )}
                </button>

                {result && (
                  <div className={`animate-slide-up ${
                    result === "VALID"
                      ? 'rounded-xl p-4' 
                      : 'rounded-xl p-4'
                  }`} style={{
                    background: result === "VALID" ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${result === "VALID" ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`
                  }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        result === "VALID" ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                        {result === "VALID" ? <IconCheck /> : "!"}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{
                          color: result === "VALID" ? '#059669' : '#dc2626'
                        }}>
                          {result === "VALID" ? "Authentic Certificate" : result === "INVALID" ? "Invalid Certificate" : "Not Found"}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {result === "VALID" ? "Verified on Ethereum Sepolia" : "No matching record on-chain"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {certificateData && (
                  <div className="rounded-xl animate-slide-up overflow-hidden" style={{ border: '1px solid var(--card-border)' }}>
                    <div className="px-5 py-3 flex items-center justify-between text-xs font-semibold" style={{ background: 'var(--card)', borderBottom: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                      <span>Credential Details</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        certificateData.nftStatus === "MINTED"
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {certificateData.nftStatus === "MINTED" ? "Soulbound NFT Minted" : "No NFT"}
                      </span>
                    </div>
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: "Student", val: certificateData.studentName },
                          { label: "Reg No", val: certificateData.regNo },
                          { label: "Course", val: certificateData.course },
                          { label: "Grade", val: certificateData.grade }
                        ].map((item) => (
                          <div key={item.label}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                            <p className="text-sm font-semibold truncate">{item.val}</p>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4" style={{ borderTop: '1px solid var(--card-border)' }}>
                        <div className="p-3 rounded-lg text-xs font-mono break-all" style={{ background: 'var(--card)', border: '1px solid var(--card-border)' }}>
                          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Blockchain Fingerprint</p>
                          <p className="break-all" style={{ color: 'var(--text-secondary)' }}>{certificateData.certificateHash}</p>
                        </div>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${certificateData.ipfsHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-secondary w-full mt-3 h-10 text-xs"
                        >
                          Download from IPFS <IconExternal />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
