import { useState, useEffect } from "react";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID  = "YOUR_EMAILJS_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY  = "YOUR_EMAILJS_PUBLIC_KEY";
const API_BASE = "";

const APP = {
  name: "TenantFight",
  tagline: "Tenant Demand Letter Writer",
  icon: "🏠",
  color: "#1a6b5a",
  colorLight: "#2d9e87",
  payhip: "https://payhip.com/b/Kp6fH",
  support: "support@tenantfight.com",
  price: "$49",
  domain: "landlorddesk.com",
  font: "'Source Serif 4', Georgia, serif",
  displayFont: "'Playfair Display', serif",
};

const STEPS = ["Intro","Tenant","Property","Issue","Demand","Generate","Letter"];

const TIPS = [
  { icon: "📋", title: "Document everything", body: "Reference specific dates, amounts, and written communications. Vague claims lose — documented ones win." },
  { icon: "💰", title: "Know your state law", body: "Security deposit rules vary by state. Many require return within 14-30 days with itemized deductions." },
  { icon: "📮", title: "Send certified mail", body: "Always send demand letters certified mail, return receipt requested. This creates a legal paper trail." },
  { icon: "⚖️", title: "Penalties can double your claim", body: "Many states impose 2-3x penalties on landlords who wrongfully withhold deposits. Your letter invokes this." },
];

const SAMPLE_LETTER = `[DATE]

Via Certified Mail — Return Receipt Requested

Jane Smith, Property Manager
Riverside Properties LLC
456 Management Ave
Boston, MA 02101

Re: Demand for Return of Security Deposit — 123 Elm Street, Apt 4B, Boston, MA 02108

Dear Ms. Smith:

This letter constitutes a formal demand for the return of my security deposit in the amount of $2,400.00, plus applicable statutory penalties under M.G.L. c. 186, §15B.

I vacated the premises at 123 Elm Street, Apt 4B, Boston, Massachusetts on October 31, 2025, providing written notice on September 30, 2025. The tenancy commenced on November 1, 2023, and I paid a security deposit of $2,400.00 at that time. Under Massachusetts law, you were required to return my deposit within 30 days of the termination of tenancy — no later than November 30, 2025. As of the date of this letter, I have received neither my deposit nor a written itemization of deductions as required under M.G.L. c. 186, §15B(6)...`;

const stepFields = {
  Tenant: [
    { key: "tenantName",    label: "Your Full Name",              type: "text",     required: true,  placeholder: "Jane Doe" },
    { key: "tenantEmail",   label: "Your Email",                  type: "text",     required: true,  placeholder: "jane@email.com" },
    { key: "tenantAddress", label: "Your Current Mailing Address",type: "text",     required: true,  placeholder: "456 New St, Boston, MA 02101" },
    { key: "tenantPhone",   label: "Your Phone Number",           type: "text",     required: false, placeholder: "(617) 555-0100" },
  ],
  Property: [
    { key: "rentalAddress", label: "Rental Property Address",     type: "text",     required: true,  placeholder: "123 Elm St, Apt 4B, Boston, MA 02108" },
    { key: "state",         label: "State",                       type: "text",     required: true,  placeholder: "Massachusetts" },
    { key: "landlordName",  label: "Landlord / Property Manager Name", type: "text", required: true, placeholder: "Jane Smith / Riverside Properties LLC" },
    { key: "landlordAddress",label: "Landlord's Mailing Address", type: "text",     required: true,  placeholder: "456 Management Ave, Boston, MA 02101" },
    { key: "leaseStart",    label: "Lease Start Date",            type: "text",     required: true,  placeholder: "November 1, 2023" },
    { key: "vacateDate",    label: "Date You Vacated",            type: "text",     required: true,  placeholder: "October 31, 2025" },
    { key: "noticeDate",    label: "Date You Gave Notice",        type: "text",     required: false, placeholder: "September 30, 2025" },
  ],
  Issue: [
    { key: "issueType",     label: "Type of Issue",               type: "select",   required: true,
      options: ["Security Deposit Not Returned","Illegal Deductions from Deposit","Habitability / Repair Issues","Illegal Entry by Landlord","Retaliation","Other Landlord Violation"] },
    { key: "depositAmount", label: "Security Deposit Amount Paid", type: "text",    required: false, placeholder: "$2,400.00" },
    { key: "whatHappened",  label: "What Happened? (Plain English)", type: "textarea", required: true,
      placeholder: "e.g. I moved out October 31st, gave 30 days notice, left the apartment in good condition with photos to prove it. My landlord never returned my $2,400 deposit and it has now been 45 days." },
    { key: "documentsHeld", label: "Documents / Evidence You Have", type: "textarea", required: false,
      placeholder: "e.g. Move-out photos, certified mail receipt for notice, copy of original lease, text messages with landlord..." },
    { key: "priorCommunication", label: "Prior Communication With Landlord About This", type: "textarea", required: false,
      placeholder: "e.g. Texted on Nov 15 asking about deposit, landlord said 'I'll get to it.' No further response." },
  ],
  Demand: [
    { key: "amountDemanded", label: "Total Amount Demanded",      type: "text",     required: true,  placeholder: "e.g. $2,400 deposit + $4,800 statutory penalty = $7,200",
      helper: "Many states allow 2-3x deposit as penalty for wrongful withholding. Include statutory penalty if applicable." },
    { key: "responseDeadline", label: "Response Deadline (days)", type: "text",     required: true,  placeholder: "14",
      helper: "14 days is standard. Too short may be unreasonable; too long reduces urgency." },
    { key: "nextSteps",     label: "What You'll Do If Ignored",   type: "select",   required: true,
      options: ["File in Small Claims Court","File complaint with state attorney general","Retain an attorney","All of the above"] },
    { key: "additionalDemands", label: "Any Additional Demands (optional)", type: "textarea", required: false,
      placeholder: "e.g. Written itemization of any claimed deductions, copy of move-in inspection report..." },
  ],
};

const requiredFields = {
  Tenant: ["tenantName","tenantEmail","tenantAddress"],
  Property: ["rentalAddress","state","landlordName","landlordAddress","leaseStart","vacateDate"],
  Issue: ["issueType","whatHappened"],
  Demand: ["amountDemanded","responseDeadline","nextSteps"],
};

const colors = {
  paper: "#f7faf9", paperWarm: "#f0f7f5", paperDark: "#e0ede9",
  white: "#ffffff", ink: "#0d1f1b", inkLight: "#2a4a42",
  inkMuted: "#4a7060", inkFaint: "#8aaa9e",
  gold: APP.color, goldLight: APP.colorLight,
  border: "#c0d8d0", borderLight: "#daeee8",
  green: "#1a5c2a", red: "#8b1a1a",
  errorBg: "#fff0f0", errorBorder: "#ffcccc", errorText: "#cc2222",
};

const inputStyle = (focused) => ({
  width: "100%", padding: "13px 16px",
  background: colors.white,
  border: `1px solid ${focused ? colors.goldLight : colors.border}`,
  borderRadius: "8px", color: colors.ink, fontSize: "15px",
  fontFamily: APP.font, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
});

const btnStyle = (active) => ({
  background: active ? `linear-gradient(135deg, ${colors.goldLight}, ${colors.gold})` : colors.paperDark,
  border: "none", color: active ? "#fff" : colors.inkFaint,
  padding: "13px 28px", borderRadius: "6px", cursor: active ? "pointer" : "default",
  fontSize: "15px", fontWeight: active ? "700" : "400", fontFamily: APP.font,
  transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: "8px",
  boxShadow: active ? `0 2px 12px ${colors.goldLight}55` : "none",
});

function Tooltip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block", marginLeft: "6px" }}>
      <span onClick={() => setOpen(o => !o)} style={{ cursor: "pointer", color: colors.goldLight, fontSize: "12px", border: `1px solid ${colors.goldLight}`, borderRadius: "50%", width: "16px", height: "16px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>?</span>
      {open && (
        <div style={{ position: "absolute", left: "22px", top: "-4px", width: "240px", zIndex: 20, background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "8px", padding: "12px 14px", fontSize: "13px", color: colors.inkLight, lineHeight: "1.6", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
          {text}
          <div onClick={() => setOpen(false)} style={{ marginTop: "8px", color: colors.goldLight, cursor: "pointer", fontSize: "11px" }}>Close ×</div>
        </div>
      )}
    </span>
  );
}

function Field({ field, value, onChange }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "4px" }}>
      <label style={{ display: "block", marginBottom: "7px", fontSize: "13px", color: colors.inkMuted, letterSpacing: "0.03em" }}>
        {field.label}
        {field.required && <span style={{ color: colors.goldLight, marginLeft: "4px" }}>*</span>}
        {field.helper && <Tooltip text={field.helper} />}
      </label>
      {field.type === "select" ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...inputStyle(focused), cursor: "pointer" }}>
          <option value="">Select...</option>
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "textarea" ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={field.rows || 4} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ ...inputStyle(focused), resize: "vertical", lineHeight: "1.7", minHeight: `${(field.rows || 4) * 28}px` }} />
      ) : (
        <input type="text" value={value || ""} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={inputStyle(focused)} />
      )}
    </div>
  );
}

function Spinner() {
  return <span style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />;
}

export default function App() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [accessCode, setAccessCode] = useState("");
  const [codeValid, setCodeValid] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [letter, setLetter] = useState("");
  const [altLetter, setAltLetter] = useState("");
  const [activeTab, setActiveTab] = useState("standard");
  const [checklist, setChecklist] = useState([]);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [error, setError] = useState("");
  const [showSample, setShowSample] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { setAccessCode(code.toUpperCase()); verifyCode(code.toUpperCase(), true); }
  }, []);

  useEffect(() => { try { const s = sessionStorage.getItem("tf_form"); if (s) setFormData(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { try { sessionStorage.setItem("tf_form", JSON.stringify(formData)); } catch {} }, [formData]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stateParam = params.get("state");
    const disputeParam = params.get("dispute");
    const slugToStateName = {
      "california": "California", "texas": "Texas", "florida": "Florida",
      "new-york": "New York", "illinois": "Illinois", "pennsylvania": "Pennsylvania",
      "ohio": "Ohio", "georgia": "Georgia", "north-carolina": "North Carolina", "arizona": "Arizona"
    };
    const slugToIssueType = {
      "security-deposit-demand-letter": "Security Deposit Not Returned",
      "habitability-violation-letter": "Habitability / Repair Issues",
      "illegal-entry-notice": "Illegal Entry by Landlord",
      "landlord-retaliation-letter": "Retaliation",
      "wrongful-eviction-response": "Other Landlord Violation",
      "utility-shutoff-letter": "Other Landlord Violation",
      "move-out-deduction-dispute": "Illegal Deductions from Deposit",
      "landlord-lease-violation": "Other Landlord Violation",
      "mold-pest-infestation-letter": "Habitability / Repair Issues",
      "quiet-enjoyment-violation": "Other Landlord Violation"
    };
    const updates = {};
    if (stateParam && slugToStateName[stateParam]) updates.state = slugToStateName[stateParam];
    if (disputeParam && slugToIssueType[disputeParam]) updates.issueType = slugToIssueType[disputeParam];
    if (Object.keys(updates).length) setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const isStepValid = (stepName) => {
    const req = requiredFields[stepName] || [];
    return req.every(k => formData[k]?.trim());
  };

  const verifyCode = async (code, silent = false) => {
    if (!code?.trim()) { setCodeError("Please enter your access code."); return; }
    setCodeError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code, systemPrompt: "Respond with only: VALID", userPrompt: "Access check" }),
      });
      if (res.status === 401) { if (!silent) setCodeError("Invalid access code. Check your Payhip receipt email."); setCodeValid(false); }
      else { setCodeValid(true); if (!silent) setStep(1); }
    } catch { if (!silent) setCodeError("Could not verify. Check your connection."); }
  };

  const callAPI = async (systemPrompt, userPrompt, reviewMode = false, draftLetter = "") => {
    const res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode, systemPrompt, userPrompt, reviewMode, draftLetter }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Generation failed"); }
    return (await res.json()).text;
  };

  const systemPrompt = `You are an expert tenant rights attorney with 20 years writing successful demand letters to landlords. Write firm, legally precise demand letters that invoke applicable state statutes by name and maximize settlement probability.

Rules:
- Open with a clear statement of the legal violation and amount demanded
- Cite the applicable state statute by name (e.g. "M.G.L. c. 186, §15B" for Massachusetts security deposits)
- Reference specific dates, amounts, and communications provided
- Invoke statutory penalty provisions where applicable (many states allow 2-3x penalties)
- Set a firm deadline with clear consequences
- Professional but firm tone — not threatening, but unmistakably serious
- 500-700 words
- Format: formal letter with [DATE] placeholder, via certified mail notation, proper salutation and signature block
- Output ONLY the letter, no preamble or commentary`;

  const buildPrompt = (tone = "standard") => {
    const base = `
TENANT: ${formData.tenantName}, ${formData.tenantAddress}
LANDLORD: ${formData.landlordName}, ${formData.landlordAddress}
PROPERTY: ${formData.rentalAddress}
STATE: ${formData.state}
LEASE: ${formData.leaseStart} to ${formData.vacateDate}
NOTICE GIVEN: ${formData.noticeDate || "not specified"}

ISSUE TYPE: ${formData.issueType}
DEPOSIT AMOUNT: ${formData.depositAmount || "not specified"}
WHAT HAPPENED: ${formData.whatHappened}
EVIDENCE: ${formData.documentsHeld || "none specified"}
PRIOR COMMUNICATION: ${formData.priorCommunication || "none"}

AMOUNT DEMANDED: ${formData.amountDemanded}
RESPONSE DEADLINE: ${formData.responseDeadline} days
IF IGNORED: ${formData.nextSteps}
ADDITIONAL DEMANDS: ${formData.additionalDemands || "none"}`;

    if (tone === "assertive") return `Write a MORE ASSERTIVE and DETAILED demand letter. Stronger language, more explicit statutory citations, more forceful consequences. Different wording from standard version:\n${base}`;
    return `Write a STANDARD PROFESSIONAL demand letter for this situation:\n${base}`;
  };

  const generateLetter = async () => {
    setLoading(true); setError(""); setLetter(""); setAltLetter(""); setChecklist([]);
    try {
      setLoadingMsg("Drafting your letter...");
      const draft = await callAPI(systemPrompt, buildPrompt("standard"));

      setLoadingMsg("Running quality review...");
      const reviewed = await callAPI("", "", true, draft);
      setLetter(reviewed);

      setLoadingMsg("Generating assertive version...");
      const alt = await callAPI(systemPrompt, buildPrompt("assertive"));
      setAltLetter(alt);

      setLoadingMsg("Building checklist...");
      const clRes = await fetch(`${API_BASE}/api/checklist`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode, address: formData.rentalAddress, state: formData.state, issueType: formData.issueType, letterExcerpt: reviewed.substring(0, 300) }),
      });
      if (clRes.ok) { const d = await clRes.json(); setChecklist(d.checklist || []); }

      setStep(STEPS.indexOf("Letter")); setRetryCount(0);
    } catch (e) {
      const n = retryCount + 1; setRetryCount(n);
      setError(n < 3 ? `Generation failed: ${e.message}. Please try again.` : "Multiple failures. Try refreshing the page or contact support.");
    }
    setLoading(false); setLoadingMsg("");
  };

  const sendEmail = async () => {
    if (!email?.includes("@")) return;
    setEmailSending(true);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_email: email, to_name: formData.tenantName,
        property: formData.rentalAddress,
        letter_standard: letter, letter_assertive: altLetter,
        from_name: APP.name, reply_to: APP.support,
      }, EMAILJS_PUBLIC_KEY);
      setEmailSent(true);
    } catch { setError("Email send failed. Please copy the letter manually."); }
    setEmailSending(false);
  };

  const copyText = (text) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); };

  const downloadPDF = (text, filename) => {
    // Use jsPDF loaded via CDN
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 72; // 1 inch
    const pageWidth = doc.internal.pageSize.getWidth();
    const usableWidth = pageWidth - margin * 2;
    const lineHeight = 14;
    const fontSize = 11;
    
    doc.setFont("Times", "normal");
    doc.setFontSize(fontSize);
    
    // Replace [DATE] with today's date
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const fullText = text.replace(/\[DATE\]/g, today);
    
    const lines = doc.splitTextToSize(fullText, usableWidth);
    let y = margin;
    
    lines.forEach(line => {
      if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    });
    
    doc.save(filename);
  };


  const reset = () => {
    setStep(codeValid ? 1 : 0); setFormData({}); setLetter(""); setAltLetter("");
    setError(""); setEmailSent(false); setChecklist([]); setRetryCount(0);
    try { sessionStorage.removeItem("tf_form"); } catch {}
  };

  const formSteps = ["Tenant","Property","Issue","Demand"];
  const currentStep = STEPS[step];

  return (
    <div style={{ minHeight: "100vh", background: colors.paper, fontFamily: APP.font, color: colors.ink }}>

      {/* Header */}
      <div style={{ background: colors.white, borderBottom: `1px solid ${colors.border}`, padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "34px", height: "34px", background: `linear-gradient(135deg, ${colors.goldLight}, ${colors.gold})`, borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>{APP.icon}</div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: "700", fontFamily: APP.displayFont, color: colors.ink }}>{APP.name}</div>
            <div style={{ fontSize: "10px", color: colors.inkFaint, letterSpacing: "0.1em", textTransform: "uppercase" }}>{APP.tagline}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {step > 0 && step < STEPS.indexOf("Letter") && (
            <button onClick={() => setShowSample(s => !s)} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: APP.font }}>{showSample ? "Hide" : "View"} Sample</button>
          )}
          {letter && <button onClick={reset} style={{ background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, padding: "7px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: APP.font }}>← New Letter</button>}
        </div>
      </div>

      {showSample && (
        <div style={{ background: colors.paperWarm, borderBottom: `1px solid ${colors.border}`, padding: "24px 28px", maxHeight: "320px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", color: colors.goldLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>Example Output</div>
          <pre style={{ fontSize: "12px", color: colors.inkLight, lineHeight: "1.8", whiteSpace: "pre-wrap", fontFamily: APP.font, margin: 0 }}>{SAMPLE_LETTER}</pre>
        </div>
      )}

      <div style={{ maxWidth: "720px", margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* INTRO / ACCESS CODE */}
        {currentStep === "Intro" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "13px", color: colors.goldLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "12px" }}>{APP.icon} {APP.name}</div>
            <h1 style={{ fontFamily: APP.displayFont, fontSize: "clamp(28px, 5vw, 44px)", color: colors.ink, marginBottom: "16px", fontWeight: "900" }}>Tenant Demand Letter Writer</h1>
            <p style={{ fontSize: "17px", color: colors.inkMuted, marginBottom: "48px", maxWidth: "480px", margin: "0 auto 40px", lineHeight: "1.7" }}>
              Attorney-quality demand letters for security deposit disputes, habitability issues, and landlord violations. Enter your access code to begin.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "40px", textAlign: "left" }}>
              {TIPS.map(t => (
                <div key={t.title} style={{ background: colors.white, border: `1px solid ${colors.borderLight}`, borderRadius: "10px", padding: "20px", display: "flex", gap: "14px" }}>
                  <span style={{ fontSize: "22px" }}>{t.icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "600", color: colors.ink, marginBottom: "4px" }}>{t.title}</div>
                    <div style={{ fontSize: "12px", color: colors.inkMuted, lineHeight: "1.6" }}>{t.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ maxWidth: "400px", margin: "0 auto", background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "12px", padding: "32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: "14px", color: colors.inkLight, marginBottom: "16px", fontWeight: "600" }}>Enter Your Access Code</div>
              <input type="text" value={accessCode} onChange={e => { setAccessCode(e.target.value.toUpperCase()); setCodeError(""); }} placeholder="e.g. LD-ABC123" style={{ ...inputStyle(false), textAlign: "center", fontSize: "18px", letterSpacing: "0.1em", marginBottom: "12px", fontWeight: "600" }} />
              {codeError && <div style={{ color: colors.errorText, fontSize: "13px", marginBottom: "12px" }}>{codeError}</div>}
              <button onClick={() => verifyCode(accessCode)} style={{ ...btnStyle(!!accessCode.trim()), width: "100%", justifyContent: "center", padding: "14px" }}>Unlock My Letter →</button>
              <div style={{ marginTop: "16px", fontSize: "12px", color: colors.inkFaint, lineHeight: "1.6" }}>
                Don't have a code? <a href={APP.payhip} style={{ color: colors.goldLight, textDecoration: "none" }}>Purchase for {APP.price} →</a>
              </div>
            </div>
          </div>
        )}

        {/* FORM STEPS */}
        {formSteps.includes(currentStep) && (
          <>
            <div style={{ marginBottom: "36px" }}>
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                {formSteps.map((s, i) => {
                  const idx = formSteps.indexOf(currentStep);
                  return <div key={s} style={{ flex: 1, height: "3px", borderRadius: "2px", background: i < idx ? colors.goldLight : i === idx ? colors.gold : colors.borderLight, transition: "background 0.3s" }} />;
                })}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                {formSteps.map((s, i) => {
                  const idx = formSteps.indexOf(currentStep);
                  return <div key={s} style={{ fontSize: "10px", color: i <= idx ? colors.goldLight : colors.borderLight, letterSpacing: "0.07em", textTransform: "uppercase" }}>{s}</div>;
                })}
              </div>
            </div>

            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontFamily: APP.displayFont, fontSize: "26px", color: colors.ink, marginBottom: "6px", fontWeight: "700" }}>
                {currentStep === "Tenant"   && "About You"}
                {currentStep === "Property" && "The Rental Property"}
                {currentStep === "Issue"    && "What Happened?"}
                {currentStep === "Demand"   && "What You're Demanding"}
              </h2>
              <p style={{ fontSize: "14px", color: colors.inkMuted, lineHeight: "1.6" }}>
                {currentStep === "Tenant"   && "Your contact information for the letter header."}
                {currentStep === "Property" && "Details about the rental and your landlord."}
                {currentStep === "Issue"    && "Describe the problem in plain English — the AI converts it to legal language."}
                {currentStep === "Demand"   && "What you want and what happens if ignored."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {stepFields[currentStep].map(f => (
                <Field key={f.key} field={f} value={formData[f.key]} onChange={v => handleChange(f.key, v)} />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "36px" }}>
              <button onClick={() => setStep(s => s - 1)} style={{ ...btnStyle(true), background: "transparent", border: `1px solid ${colors.border}`, color: colors.inkMuted, boxShadow: "none" }}>← Back</button>
              <button onClick={() => setStep(s => s + 1)} disabled={!isStepValid(currentStep)} style={btnStyle(isStepValid(currentStep))}>Continue →</button>
            </div>
          </>
        )}

        {/* GENERATE */}
        {currentStep === "Generate" && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontFamily: APP.displayFont, fontSize: "30px", color: colors.ink, marginBottom: "12px" }}>Ready to Generate</h2>
            <p style={{ fontSize: "16px", color: colors.inkMuted, marginBottom: "40px", maxWidth: "480px", margin: "0 auto 36px", lineHeight: "1.7" }}>
              Enter your email to receive a copy, then click Generate. The AI runs a two-pass quality review — about 20–30 seconds.
            </p>
            <div style={{ maxWidth: "420px", margin: "0 auto" }}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={{ ...inputStyle(false), textAlign: "center", marginBottom: "16px", fontSize: "15px" }} />
              <button onClick={generateLetter} disabled={loading} style={{ ...btnStyle(!loading), width: "100%", justifyContent: "center", padding: "16px", fontSize: "17px" }}>
                {loading ? <><Spinner /> {loadingMsg || "Generating..."}</> : "Generate My Letter ✦"}
              </button>
              {error && (
                <div style={{ marginTop: "16px", padding: "13px 16px", background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: "8px", color: colors.errorText, fontSize: "13px" }}>
                  {error}
                  {retryCount < 3 && <button onClick={generateLetter} style={{ marginLeft: "12px", background: "transparent", border: "none", color: colors.goldLight, cursor: "pointer", fontFamily: APP.font, fontSize: "13px" }}>Try again →</button>}
                </div>
              )}
              <div style={{ marginTop: "14px", fontSize: "12px", color: colors.inkFaint }}>Two-pass AI review • Standard + Assertive versions • Submission checklist</div>
            </div>
            <button onClick={() => setStep(s => s - 1)} style={{ marginTop: "28px", background: "transparent", border: "none", color: colors.inkFaint, cursor: "pointer", fontFamily: APP.font, fontSize: "13px" }}>← Edit my answers</button>
          </div>
        )}

        {/* LETTER OUTPUT */}
        {currentStep === "Letter" && letter && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
              <div>
                <div style={{ fontFamily: APP.displayFont, fontSize: "24px", color: colors.gold, marginBottom: "4px" }}>Your Letter is Ready</div>
                <div style={{ fontSize: "13px", color: colors.inkFaint }}>Two-pass AI reviewed · Two versions · Checklist included</div>
              </div>
              <div style={{display:"flex",gap:"8px"}}><button onClick={() => copyText(activeTab === "standard" ? letter : altLetter)} style={btnStyle(true)}>{copied ? "✓ Copied!" : "Copy Letter"}</button><button onClick={() => downloadPDF(activeTab === "standard" ? letter : altLetter, `${APP.name.replace(/\s+/g,"-")}-letter.pdf`)} style={{...btnStyle(true), marginLeft: "8px", background: "transparent", border: `1px solid ${colors.goldLight}`, color: colors.goldLight}}>⬇ PDF</button></div>
            </div>

            {altLetter && (
              <div style={{ display: "flex", gap: "2px", background: colors.paperDark, padding: "4px", borderRadius: "8px", marginBottom: "6px" }}>
                {[["standard","Standard / Professional"],["assertive","Assertive / Detailed"]].map(([key, label]) => (
                  <button key={key} onClick={() => setActiveTab(key)} style={{ flex: 1, padding: "10px", borderRadius: "6px", border: "none", cursor: "pointer", fontFamily: APP.font, fontSize: "13px", transition: "all 0.2s", background: activeTab === key ? `linear-gradient(135deg, ${colors.goldLight}, ${colors.gold})` : "transparent", color: activeTab === key ? "#fff" : colors.inkMuted, fontWeight: activeTab === key ? "600" : "400" }}>{label}</button>
                ))}
              </div>
            )}
            <div style={{ fontSize: "12px", color: colors.inkFaint, marginBottom: "16px" }}>
              {activeTab === "standard" ? "Measured, professional tone. Good for initial demand." : "Stronger framing. Better when prior requests have been ignored."}
            </div>

            <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "40px 48px", lineHeight: "1.9", fontSize: "14px", color: colors.inkLight, whiteSpace: "pre-wrap", fontFamily: APP.font, boxShadow: "0 4px 32px rgba(0,0,0,0.08)", marginBottom: "24px" }}>
              {activeTab === "standard" ? letter : altLetter}
            </div>

            {email && !emailSent && (
              <div style={{ background: colors.paperWarm, border: `1px solid ${colors.border}`, borderRadius: "8px", padding: "18px 22px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                <div style={{ fontSize: "14px", color: colors.inkLight }}>Send a copy to <strong>{email}</strong></div>
                <button onClick={sendEmail} disabled={emailSending} style={{ ...btnStyle(!emailSending), padding: "9px 20px", fontSize: "13px" }}>{emailSending ? <><Spinner /> Sending...</> : "Send Copy →"}</button>
              </div>
            )}
            {emailSent && <div style={{ background: "#e8f5e8", border: "1px solid #b0d8b0", borderRadius: "8px", padding: "14px 20px", marginBottom: "20px", fontSize: "14px", color: colors.green }}>✓ Letter emailed to {email}</div>}

            {checklist.length > 0 && (
              <div style={{ background: colors.white, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "24px 28px", marginBottom: "20px" }}>
                <div style={{ fontSize: "12px", color: colors.goldLight, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>Next Steps Checklist</div>
                {checklist.map((item, i) => (
                  <label key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", cursor: "pointer", alignItems: "flex-start" }}>
                    <input type="checkbox" style={{ marginTop: "3px", accentColor: colors.goldLight }} />
                    <span style={{ fontSize: "14px", color: colors.inkLight, lineHeight: "1.5" }}>{item}</span>
                  </label>
                ))}
              </div>
            )}

            <div style={{ background: "#fdf8ff", border: "1px solid #d8c8e8", borderRadius: "10px", padding: "20px 24px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "14px" }}>
                <span style={{ fontSize: "22px" }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "13px", color: "#7050a0", fontWeight: "600", marginBottom: "6px" }}>Consider small claims court if ignored.</div>
                  <div style={{ fontSize: "12px", color: "#9070b0", lineHeight: "1.6" }}>Most security deposit disputes are ideal for small claims — no attorney needed, filing fees are low, and many states award double or triple damages for wrongful withholding.</div>
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#9070b0" }}>Search: <span style={{ color: colors.goldLight }}>"{formData.state} small claims court filing"</span></div>
                </div>
              </div>
            </div>

            <div style={{ padding: "14px 18px", background: colors.paperWarm, borderRadius: "8px", border: `1px solid ${colors.borderLight}`, fontSize: "11px", color: colors.inkFaint, lineHeight: "1.7" }}>
              <strong>Legal Disclaimer:</strong> This letter is AI-generated and does not constitute legal advice. Review all content for accuracy. Tenant rights laws vary significantly by state. For complex disputes or large amounts, consult a licensed tenant rights attorney.
            </div>

            <div style={{ marginTop: "24px", textAlign: "center", padding: "20px", background: colors.white, borderRadius: "10px", border: `1px solid ${colors.borderLight}` }}>
              <div style={{ fontSize: "14px", color: colors.inkMuted, marginBottom: "6px" }}>Did your landlord respond?</div>
              <div style={{ fontSize: "12px", color: colors.inkFaint }}>Share your outcome → <span style={{ color: colors.goldLight }}>results@tenantfight.com</span></div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; } body { margin: 0; } @media print { button, .no-print { display: none !important; } body { background: #fff; } @page { margin: 0.75in; } }`}</style>
      <footer style={{ textAlign: "center", padding: "16px", fontSize: "0.72rem", color: "#888", borderTop: "1px solid #e5e0d6", marginTop: "40px" }}>
        TenantFight v1.0 · © 2026 The Super Simple Software Company · support@buyappsonce.com
      </footer>
    </div>
  );
}
