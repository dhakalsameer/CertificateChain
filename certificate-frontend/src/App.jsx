import { useState, useEffect } from "react";
import { ethers, BrowserProvider, Contract } from "ethers";

import contractJson from "./abi/CertificateRegistry.json";
import { generateFileHash } from "./utils/hash";
import { uploadFileToPinata } from "./utils/pinata";

const CONTRACT_ADDRESS = "0x871086DA3fA39378DDaaae6c2CA79ec1bac5a92C";
const ABI = contractJson.abi || contractJson;

export default function App() {
  const [account, setAccount] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  const [form, setForm] = useState({
    studentName: "",
    regNo: "",
    course: "",
    grade: "",
  });

  const [issueFile, setIssueFile] = useState(null);
  const [verifyFile, setVerifyFile] = useState(null);

  const [verifyHash, setVerifyHash] = useState("");
  const [result, setResult] = useState("");
  const [certificateData, setCertificateData] = useState(null);
  const [issued, setIssued] = useState(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        const newAccount = accounts[0] || "";
        setAccount(newAccount);
        if (newAccount) checkAdminStatus(newAccount);
        else setIsAdmin(false);
      });
    }
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const checkAdminStatus = async (addr) => {
    try {
      const contract = await getContract();
      const status = await contract.isAdmin(addr);
      setIsAdmin(status);
    } catch (err) {
      console.error("Admin check failed", err);
    }
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
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const getContract = async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed");
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, ABI, signer);
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const issueCertificate = async () => {
    try {
      if (!form.studentName || !form.regNo || !form.course || !form.grade || !issueFile) {
        alert("Please fill all fields and upload a file ✍️");
        return;
      }

      setIsIssuing(true);
      const contract = await getContract();
      
      const certHash = await generateFileHash(issueFile);
      const ipfsHash = await uploadFileToPinata(issueFile, {
        name: `Cert: ${form.studentName}`,
        keyvalues: { student: form.studentName, reg: form.regNo }
      });

      const tx = await contract.issueCertificate(
        form.studentName,
        form.regNo,
        form.course,
        form.grade,
        certHash,
        ipfsHash
      );

      await tx.wait();
      setIssued({ certHash, ipfsHash });
      setForm({ studentName: "", regNo: "", course: "", grade: "" });
      setIssueFile(null);
      alert("Certificate Issued Successfully! ✅");
    } catch (err) {
      console.error(err);
      alert(err?.message || "Transaction Failed");
    } finally {
      setIsIssuing(false);
    }
  };

  const verifyCertificate = async () => {
    try {
      let hashToVerify = verifyHash;
      if (verifyFile) {
        setIsVerifying(true);
        hashToVerify = await generateFileHash(verifyFile);
      }

      if (!hashToVerify) {
        alert("Please enter a hash or upload a file");
        return;
      }

      setIsVerifying(true);
      const contract = await getContract();
      const valid = await contract.verifyCertificate(hashToVerify);

      if (!valid) {
        setResult("INVALID ❌");
        setCertificateData(null);
        return;
      }

      const cert = await contract.getCertificate(hashToVerify);
      setCertificateData({
        studentName: cert.studentName,
        regNo: cert.registrationNumber,
        course: cert.course,
        grade: cert.grade,
        certificateHash: cert.certificateHash,
        ipfsHash: cert.ipfsHash
      });
      setResult("VALID CERTIFICATE ✅");
    } catch (err) {
      console.error(err);
      setResult("NOT FOUND ❌");
      setCertificateData(null);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 transition-colors duration-300">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">🎓</span>
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
              Certi<span className="text-primary">Chain</span>
            </span>
            {account && (
              <span className={`role-badge ml-3 ${isAdmin ? "role-badge-admin" : "role-badge-user"}`}>
                {isAdmin ? "Admin" : "Public User"}
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>

            <button
              onClick={connectWallet}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-full font-medium transition-all ${
                account 
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" 
                  : "bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${account ? "bg-accent animate-pulse" : "bg-white/50"}`}></span>
              <span className="hidden sm:inline">{account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}</span>
              <span className="sm:hidden">{account ? "Connected" : "Connect"}</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-12">
        {/* Hero Section */}
        <section className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
            <span className="gradient-text">Immutable Academic Proof</span>
          </h2>
          <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto px-4 font-medium">
            Secure, verifiable, and permanent certificates powered by Ethereum and IPFS. 
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* Issue Section - Only for Admin */}
          {isAdmin ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/20 flex items-center justify-center text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">Issuer Console</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Authorized Management</p>
                </div>
              </div>

              <div className="glass-card p-8 md:p-10 rounded-[2.5rem] space-y-8 border-slate-200/60">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { label: "Student Name", name: "studentName", placeholder: "e.g. Sameer Dhakal" },
                    { label: "Registration ID", name: "regNo", placeholder: "e.g. BCT-2078" },
                    { label: "Course Title", name: "course", placeholder: "e.g. Computer Engineering" },
                    { label: "Grade", name: "grade", placeholder: "e.g. A+" }
                  ].map((field) => (
                    <div key={field.name} className="space-y-1">
                      <label className="label-text">{field.label}</label>
                      <input
                        name={field.name}
                        value={form[field.name]}
                        onChange={handleChange}
                        placeholder={field.placeholder}
                        className="input-field"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <label className="label-text">Certificate Document</label>
                  <div className="relative group">
                    <input
                      type="file"
                      onChange={(e) => setIssueFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 group-hover:border-primary group-hover:bg-primary/5 transition-all flex items-center justify-center space-x-3">
                      <svg className="w-5 h-5 text-slate-500 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary truncate max-w-[200px]">
                        {issueFile ? issueFile.name : "Select Document"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={issueCertificate}
                  disabled={isIssuing}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {isIssuing ? "Processing..." : "Issue Certificate"}
                </button>

                {issued && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-2xl animate-in zoom-in-95">
                    <p className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center text-xs uppercase tracking-widest mb-2">
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      On-Chain Success
                    </p>
                    <a 
                      href={`https://gateway.pinata.cloud/ipfs/${issued.ipfsHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary font-bold hover:underline inline-flex items-center"
                    >
                      Verify Document on IPFS ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="lg:flex items-center justify-center p-8 text-center glass-card rounded-3xl animate-in fade-in duration-700">
               <div className="max-w-xs space-y-4">
                 <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-3xl">🛡️</div>
                 <h3 className="text-xl font-bold text-slate-800 dark:text-white">Public Verification Portal</h3>
                 <p className="text-sm text-slate-500 dark:text-slate-400">As a public user, you can verify any certificate issued on our network. Connect as an authorized admin to manage credentials.</p>
               </div>
            </div>
          )}

          {/* Verify Section */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-600/20 flex items-center justify-center text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.040L3 5.618a11.955 11.955 0 0112 21.382 11.955 11.955 0 018.618-15.764z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">Audit Protocol</h3>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Public Verification Engine</p>
              </div>
            </div>

            <div className="glass-card p-8 md:p-10 rounded-[2.5rem] space-y-8">
              <div className="space-y-4">
                <div className="relative group cursor-pointer space-y-1">
                  <label className="label-text">Option 1: Verify via Original File</label>
                  <input
                    type="file"
                    onChange={(e) => { setVerifyFile(e.target.files[0]); setVerifyHash(""); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/30 flex flex-col items-center justify-center text-center transition-all group-hover:bg-slate-100 dark:group-hover:bg-slate-800/50">
                    <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-slate-800 dark:text-slate-300 font-bold">{verifyFile ? verifyFile.name : "Drag certificate file here"}</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Digital Fingerprint Analysis</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                  <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-600 font-black tracking-widest">or</span></div>
                </div>

                <div className="space-y-1">
                  <label className="label-text">Option 2: Verify via Blockchain Hash</label>
                  <input
                    value={verifyHash}
                    onChange={(e) => { setVerifyHash(e.target.value); setVerifyFile(null); }}
                    placeholder="Enter SHA256 string..."
                    className="input-field"
                  />
                </div>
              </div>

              <button
                onClick={verifyCertificate}
                disabled={isVerifying}
                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-2xl hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-xl shadow-slate-200 dark:shadow-none"
              >
                {isVerifying ? "Scanning Blockchain..." : "Verify Authenticity"}
              </button>

              {result && (
                <div className={`p-4 rounded-2xl flex items-center space-x-3 animate-in zoom-in-95 ${
                  result.includes("VALID") ? "bg-accent/10 text-accent border border-accent/20" : "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20"
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${result.includes("VALID") ? "bg-accent text-white" : "bg-rose-500 text-white"}`}>
                    {result.includes("VALID") ? "✓" : "!"}
                  </div>
                  <span className="font-bold text-lg">{result}</span>
                </div>
              )}

              {certificateData && (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm animate-in fade-in zoom-in-95">
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Credential Metadata</span>
                    <span className="text-[10px] font-medium text-slate-400 italic underline">verified on-chain</span>
                  </div>
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: "Student", val: certificateData.studentName },
                        { label: "Reg No", val: certificateData.regNo },
                        { label: "Course", val: certificateData.course },
                        { label: "Achievement", val: certificateData.grade }
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{item.label}</p>
                          <p className="font-bold text-slate-800 dark:text-white truncate">{item.val}</p>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                       <p className="text-[10px] text-slate-400 truncate w-full sm:max-w-[200px]"><b>Hash:</b> {certificateData.certificateHash}</p>
                       <a 
                        href={`https://gateway.pinata.cloud/ipfs/${certificateData.ipfsHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-secondary py-2 px-4 text-xs flex items-center justify-center w-full sm:w-auto"
                      >
                        Source ↗
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
