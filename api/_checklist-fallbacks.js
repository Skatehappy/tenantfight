// api/_checklist-fallbacks.js — per-letter-type checklist content, shared by api/checklist.js (Edge-safe: no imports).
// `focus` steers the model; `steps` is the static fallback used when the model list is unusable (call failed,
// cut off twice, or too few items survived the citation/figure lock). Fallback items are plain action steps only:
// no statute, case, deadline, dollar amount, percentage or day count, so nothing here needs a VERIFICATION_LOG
// entry. Deposit wording appears only on the two deposit types.

const COMMON_START = ['Send the letter by certified mail, return receipt requested, and keep the tracking number', 'Keep a complete copy of everything you send'];
const COMMON_END = ['Write down the date you sent the letter and the date any response arrives', 'If the problem is not fixed, consider a free consult with a local tenant legal-aid group or an attorney'];

export const TYPES = {
  'Security Deposit Not Returned': {
    focus: 'a security deposit that was not returned or not itemized',
    steps: ['Gather proof of the deposit payment: cancelled check, bank statement or receipt', 'Photograph or video the unit as you left it, with dates visible', 'Collect your move-out notice and any written communication about the deposit', 'Write down the date you vacated and the forwarding address you gave the landlord', "Check your state's deposit-return rules for the deadline and any penalty for the landlord"],
  },
  'Illegal Deductions from Deposit': {
    focus: 'improper deductions taken from a security deposit',
    steps: ['Get the itemized list of deductions and any receipts or invoices the landlord relied on', 'Compare each deduction with your move-in and move-out photos or inspection reports', 'Gather proof of the deposit payment: cancelled check, bank statement or receipt', 'Separate normal wear and tear from damage as you mark up the list, item by item', "Check your state's deposit rules for what a landlord may deduct and what penalty applies"],
  },
  'Move-In / Move-Out Condition Dispute': {
    focus: 'a dispute over the condition of the unit at move-in or move-out',
    steps: ['Collect your move-in checklist, inspection report and any dated photos or video', 'Collect your move-out photos or video, with dates visible', 'Gather texts, emails and letters about the condition of the unit', 'List each disputed item with what the landlord claims and what your evidence shows', 'Ask the landlord in writing for copies of any inspection reports or repair invoices'],
  },
  'Habitability / Repair Issues': {
    focus: 'a repair or habitability problem the landlord has not fixed',
    steps: ['Photograph or video each defect with dates visible, and keep taking dated photos while it continues', 'Keep a dated log of every repair request: date, how you asked, and who you spoke to', "Save every text, email and letter about the problem and the landlord's answers", 'Note any health or safety effect, and keep medical notes or receipts that relate to it', 'Check whether your city or county has a housing code office that takes complaints and inspection requests'],
  },
  'Illegal Entry by Landlord': {
    focus: 'a landlord entering the rental without proper notice or permission',
    steps: ['Write down the date, time and circumstances of each entry, and who was present', 'Save any notice, text or voicemail the landlord gave, or note that none was given', 'Photograph or video anything moved, damaged or taken, and any lock or door changes', 'Note any witnesses and get their names and contact details', 'Keep a copy of your lease and the entry and notice terms it contains'],
  },
  'Retaliation': {
    focus: 'landlord retaliation after the tenant complained or used a legal right',
    steps: ['Build a dated timeline: your complaint or protected action first, then each action the landlord took', 'Save the written proof of your complaint or request: emails, texts, letters, agency filings', 'Keep every notice, rent change or reduced-service message the landlord sent afterwards', 'Photograph any change in services or conditions, with dates visible', 'Keep copies of your rent payment records to show you were not in default'],
  },
  'Utility Shutoff': {
    focus: 'a landlord shutting off or interrupting a utility or service such as heat, water, gas or electricity',
    steps: ['Write down the date and time the utility went off, and each time it was restored or interrupted again', 'Photograph or video the affected meter, thermostat, fixtures or any lockbox or notice, with dates visible', "Ask the utility company whether the account is in your name or the landlord's, and get the answer in writing", 'Keep receipts for hotels, food, space heaters or other costs you had because of the shutoff', 'Save every text, email or voicemail with the landlord about the shutoff and the reason given', 'If there is a health or safety risk, call your local emergency or housing-code line and note the report number'],
  },
  'Lease Violation by Landlord': {
    focus: 'a landlord breaching a term of the lease',
    steps: ['Highlight the lease clause the landlord violated and keep a copy of the full signed lease', 'Write down each date the violation happened and what you lost or paid because of it', 'Collect emails, texts and notices that show the violation and your requests to fix it', 'Keep receipts or records for any out-of-pocket costs the violation caused', 'Ask the landlord in writing to cure the violation, and say what you want done'],
  },
  'Discrimination / Fair Housing Violation': {
    focus: 'housing discrimination or a fair housing violation by the landlord',
    steps: ['Write down what was said or done, by whom, on what dates, and who else saw or heard it', 'Save every message, ad, application, denial and notice that shows how you were treated', 'Note how others in a similar situation were treated, if you know, without guessing', 'Keep records of any costs or lost housing opportunities that resulted', 'Consider contacting a fair housing organization or your state or local civil rights agency, which can take complaints'],
  },
  'Wrongful Eviction Notice': {
    focus: 'an eviction notice or lockout the tenant believes is improper',
    steps: ['Keep the notice itself, the envelope, and a note of exactly how and when you received it', 'Gather proof of your rent payments and any dated communication with the landlord', 'Check the notice against your lease for the reason, dates and delivery method it states', 'Do not ignore court papers; note every court date and deadline you are given', 'Contact local legal aid or a tenant attorney promptly, because eviction cases can move quickly'],
  },
  'Other Landlord Violation': {
    focus: 'a landlord violation not covered by the other categories',
    steps: ['Write a short dated timeline of what happened and what you asked the landlord to do', 'Gather your lease, notices, texts, emails and photos that relate to the problem', 'Keep receipts or records for any money you lost or spent because of it', 'State clearly in your letter what you want the landlord to do'],
  },
};

const norm = s => String(s || '').trim().toLowerCase();
export function typeInfo(issueType) {
  const k = Object.keys(TYPES).find(t => norm(t) === norm(issueType));
  return TYPES[k || 'Other Landlord Violation'];
}
export function fallbackFor(issueType) {
  return [...COMMON_START, ...typeInfo(issueType).steps, ...COMMON_END];
}
