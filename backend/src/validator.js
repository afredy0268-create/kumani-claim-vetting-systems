/*
  backend/src/validator.js
  Implements Phase 2 validation rules using local DB reference tables.
  Exports: validateClaimItems(claimId) -> returns array of { item, issues }
*/

const db = require('../db'); // better-sqlite3 db instance
const moment = require('moment'); // optional, but helpful if installed

function ageYears(dobText, refDateText) {
  if (!dobText) return null;
  try {
    const dob = new Date(dobText);
    const ref = refDateText ? new Date(refDateText) : new Date();
    let age = ref.getFullYear() - dob.getFullYear();
    if (new Date(ref.getFullYear(), dob.getMonth(), dob.getDate()) > ref) age--;
    return age;
  } catch (e) { return null; }
}

function isCovered(code) {
  try {
    const row = db.prepare('SELECT is_covered FROM benefit_list WHERE code = ?').get(code);
    if (!row) return null; // unknown
    return String(row.is_covered).toUpperCase() === 'YES';
  } catch (e) { return null; }
}

function medicineRule(code) {
  try {
    const row = db.prepare('SELECT * FROM medicine_rules WHERE code = ?').get(code);
    return row || null;
  } catch (e) { return null; }
}

function dxTxRecommended(icd) {
  try {
    const row = db.prepare('SELECT recommended FROM dx_tx_map WHERE icd = ?').get(icd);
    return row ? row.recommended : null;
  } catch (e) { return null; }
}

function memberStatus(nhis_id) {
  try {
    const row = db.prepare('SELECT status FROM member_status WHERE nhis_id = ?').get(nhis_id);
    return row ? row.status : null;
  } catch (e) { return null; }
}

function estimateQtyFromRx(prescription) {
  // prescription: { dose: "2 TABS", frequency: "8 HOURLY", duration: "3 DAYS" }
  if (!prescription) return null;
  try {
    const dose = prescription.dose ? parseInt((prescription.dose+'').split(' ')[0]) : 1;
    const duration = prescription.duration ? parseInt((prescription.duration+'').split(' ')[0]) : null;
    const freq = (prescription.frequency || '').toUpperCase();
    let dosesPerDay = null;
    if (freq.includes('HOURLY')) {
      const parts = freq.split(' ');
      const hr = parseInt(parts[0]);
      if (hr>0) dosesPerDay = Math.floor(24 / hr);
    } else if (freq.includes('DAILY')) dosesPerDay = 1;
    else if (freq.includes('12')) dosesPerDay = 2;
    if (duration && dosesPerDay) return dose * dosesPerDay * duration;
    return null;
  } catch (e) { return null; }
}

function validateClaimItems(claimId) {
  const items = db.prepare('SELECT * FROM claim_items WHERE claim_id = ?').all(claimId);
  const issues = [];
  // Build quick index per patient+visit for duplicates and polypharmacy
  const byPatientVisit = {};
  items.forEach(it => {
    const key = (it.nhis_id||'') + '|' + (it.visit_date||'');
    if (!byPatientVisit[key]) byPatientVisit[key] = [];
    byPatientVisit[key].push(it);
  });

  for (const it of items) {
    const itIssues = [];
    // NHIS ID 5-digit check
    if (!it.nhis_id || !/^\d{5}$/.test(String(it.nhis_id))) {
      itIssues.push({ code: 'INVALID_NHIS_ID', message: 'NHIS ID must be 5 digits' });
    }
    // Age calculation & GDRG checks
    const age = ageYears(it.dob, it.visit_date);
    if (it.gdrg) {
      const last = String(it.gdrg).slice(-1).toUpperCase();
      if (last === 'C' && age !== null && age >= 12) itIssues.push({ code: 'GDRG_AGE_MISMATCH', message: 'GDRG ending C expected age < 12' });
      if (last === 'A' && age !== null && age < 12) itIssues.push({ code: 'GDRG_AGE_MISMATCH', message: 'GDRG ending A expected age >= 12' });
    }
    // Benefit coverage
    const covered = isCovered(it.code);
    if (covered === false) itIssues.push({ code: 'NOT_COVERED', message: 'Benefit not covered under NHIS' });
    // Inactive member
    const mstat = memberStatus(it.nhis_id);
    if (mstat && String(mstat).toUpperCase() !== 'ACTIVE') itIssues.push({ code: 'INACTIVE_MEMBER', message: 'Member status not ACTIVE' });
    // Duplicate claims/meds detection (same patient, visit, code)
    const pvKey = (it.nhis_id||'') + '|' + (it.visit_date||'');
    if (byPatientVisit[pvKey]) {
      const dup = byPatientVisit[pvKey].filter(x => x.code === it.code);
      if (dup.length > 1) itIssues.push({ code: 'DUPLICATE_ITEM', message: 'Duplicate claim/medicine detected for same patient/visit/code' });
    }
    // Medicine specific checks
    if (String((it.code||'')).trim() !== '') {
      const mr = medicineRule(it.code);
      if (mr) {
        // Oversupply
        if (mr.max_qty && it.quantity && it.quantity > mr.max_qty) itIssues.push({ code: 'OVERSUPPLY', message: `Quantity ${it.quantity} exceeds max ${mr.max_qty}` });
        // Age limits
        if (mr.max_age_years !== null && mr.max_age_years !== undefined && age !== null) {
          if (mr.max_age_years >=0 && age > mr.max_age_years) itIssues.push({ code: 'AGE_MED_MISMATCH', message: `Medicine ${it.code} max age ${mr.max_age_years}` });
        }
        if (mr.adult_only && age !== null && age < 12) itIssues.push({ code: 'AGE_MED_ADULTONLY', message: `Medicine ${it.code} for adults only` });
      }
    } else {
      itIssues.push({ code: 'MISSING_MED_CODE', message: 'Medicine code missing' });
    }
    // Prescription vs dispensed check (if prescription fields present in item)
    try {
      const pres = { dose: it.dose, frequency: it.frequency, duration: it.duration };
      const est = estimateQtyFromRx(pres);
      if (est !== null && it.quantity !== null && it.quantity !== undefined) {
        if (Number(est) !== Number(it.quantity)) itIssues.push({ code: 'QTY_MISMATCH', message: `Dispensed ${it.quantity} vs Rx-estimate ${est}` });
      }
    } catch (e) {}
    // Treatment-Diagnosis mismatch (basic check using dx_tx_map)
    if (it.diagnosis) {
      const rec = dxTxRecommended(it.diagnosis);
      if (rec && it.treatment) {
        if (!String(rec).includes(String(it.treatment))) {
          itIssues.push({ code: 'TREATMENT_DIAGNOSIS_MISMATCH', message: 'Treatment not in recommended list for diagnosis' });
        }
      }
    }

    if (itIssues.length>0) issues.push({ item: it, issues: itIssues });
  } // end items loop

  return issues;
}

module.exports = { validateClaimItems };
