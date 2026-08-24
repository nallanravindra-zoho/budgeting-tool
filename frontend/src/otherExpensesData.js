/**
 * Data layer for the Other Expenses Budgeting Module.
 * Phase 1 (this file, current scope): GL ledger sync results, mapping
 * workspace, category taxonomy admin.
 * NOT YET BUILT (follow-on phases): growth assumptions, agreements
 * registers, the trend/agreement budget-generation engine, and the
 * actual-vs-budget dashboard. Those need their own functions here once
 * mapping is confirmed working against real data — see the module spec's
 * own stated build order (mapping first, since the budget engine can't
 * calculate anything meaningful until accounts are mapped to categories).
 */
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, deleteDoc,
  query, where, Timestamp, writeBatch,
} from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);

// ---- Category taxonomy -------------------------------------------------
// Flat collection with self-reference: a doc with parentCategoryId === null
// is a top-level category; one with it set is a subcategory of that parent.
// Addable/editable by any approved user, not just a developer — per spec §4.

export async function getExpenseCategories() {
  const snap = await getDocs(collection(db, "expenseCategories"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addExpenseCategory(name, parentCategoryId = null) {
  const ref = await addDoc(collection(db, "expenseCategories"), {
    name: name.trim(), parentCategoryId, createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function removeExpenseCategory(categoryId) {
  // Doesn't cascade-delete subcategories or un-map accounts pointing at
  // this category — a category with dependents probably shouldn't be
  // deletable at all. Basic guard for now; a fuller "in use, can't delete"
  // check belongs in the UI layer once the mapping workspace can show it.
  await deleteDoc(doc(db, "expenseCategories", categoryId));
}

// ---- GL account <-> category mapping ------------------------------------
// Not year-scoped — an account's mapping persists across years. Rows are
// created automatically (as "unmapped") by syncOtherExpensesLedger the
// first time an account is seen; this file only reads and updates them.

export async function getGlAccountMappings() {
  const snap = await getDocs(collection(db, "glAccountMappings"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getUnmappedAccounts() {
  const q = query(collection(db, "glAccountMappings"), where("mappingStatus", "==", "unmapped"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setGlAccountMapping(accountId, categoryId, subcategoryId, mappedByEmail) {
  await setDoc(doc(db, "glAccountMappings", accountId), {
    categoryId, subcategoryId: subcategoryId || null,
    mappingStatus: "mapped", mappedBy: mappedByEmail, mappedAt: Timestamp.now(),
  }, { merge: true });
}

// Sends an account back to the unmapped queue — e.g. if it was mapped to
// the wrong category and needs re-triage rather than a direct fix.
export async function unmapGlAccount(accountId) {
  await setDoc(doc(db, "glAccountMappings", accountId), {
    categoryId: null, subcategoryId: null, mappingStatus: "unmapped",
  }, { merge: true });
}

// ---- Category rollup (actuals by category, for the dashboard view) --------
// Firestore has no server-side JOIN, so this reads ledger accounts for a
// year plus the (year-independent) mapping collection, and joins them
// client-side. Returns one row per category with its 12-month total
// (summed across every account mapped to it, and its subcategories) plus
// the list of contributing accounts for the expand-to-detail view.
export async function getCategoryRollup(year) {
  const [ledgerSnap, mappingSnap, categoriesSnap] = await Promise.all([
    getDocs(collection(db, "otherExpensesLedger", String(year), "accounts")),
    getDocs(collection(db, "glAccountMappings")),
    getDocs(collection(db, "expenseCategories")),
  ]);

  const ledgerById = {};
  ledgerSnap.docs.forEach(d => { ledgerById[d.id] = d.data(); });
  const mappingById = {};
  mappingSnap.docs.forEach(d => { mappingById[d.id] = { id: d.id, ...d.data() }; });
  const categories = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Bucket every ledger account (that has actuals for this year) under its
  // mapped category. Accounts mapped to a SUBcategory roll up into both
  // the subcategory's own total and its parent's total, so the parent row
  // shows the full picture without needing to expand every child.
  const monthlyByCategory = {}; // categoryId -> number[12]
  const accountsByCategory = {}; // categoryId -> [{...account, categoryId, subcategoryId}]
  const addTo = (categoryId, account, monthly) => {
    if (!monthlyByCategory[categoryId]) monthlyByCategory[categoryId] = new Array(12).fill(0);
    monthly.forEach((v, i) => { monthlyByCategory[categoryId][i] += v || 0; });
    if (!accountsByCategory[categoryId]) accountsByCategory[categoryId] = [];
    accountsByCategory[categoryId].push(account);
  };

  for (const accountId in ledgerById) {
    const ledger = ledgerById[accountId];
    const mapping = mappingById[accountId];
    if (!mapping || mapping.mappingStatus !== "mapped" || !mapping.categoryId) continue; // unmapped accounts don't appear in the rollup — see the Unmapped queue instead
    const monthly = ledger.monthlyActual || new Array(12).fill(0);
    const account = { id: accountId, entity: ledger.entity, glCode: ledger.glCode, glName: ledger.glName, monthlyTotal: monthly.reduce((s, v) => s + v, 0), categoryId: mapping.categoryId, subcategoryId: mapping.subcategoryId || null };
    if (mapping.subcategoryId) addTo(mapping.subcategoryId, account, monthly);
    addTo(mapping.categoryId, account, monthly); // always also rolls up to the top-level category, even if mapped to a subcategory
  }

  const topLevel = categories.filter(c => !c.parentCategoryId);
  const subOf = (parentId) => categories.filter(c => c.parentCategoryId === parentId);

  return topLevel
    .map(cat => ({
      ...cat,
      monthly: monthlyByCategory[cat.id] || new Array(12).fill(0),
      total: (monthlyByCategory[cat.id] || []).reduce((s, v) => s + v, 0),
      accounts: accountsByCategory[cat.id] || [],
      subcategories: subOf(cat.id).map(sub => ({
        ...sub,
        monthly: monthlyByCategory[sub.id] || new Array(12).fill(0),
        total: (monthlyByCategory[sub.id] || []).reduce((s, v) => s + v, 0),
        accounts: accountsByCategory[sub.id] || [],
      })),
    }))
    .sort((a, b) => b.total - a.total);
}

// ---- Agreements (rent / consultant / subscription, unified) --------------
// One collection with a `type` field, per the confirmed decision — simpler
// than three separate CRUD screens. Not year-scoped; an agreement's own
// start/end dates determine which years it's active for.
//
// Type-specific fields:
//   rent:         monthlyRent, escalationPct, leaseStart, leaseEnd
//   consultant:   fee, frequency ("monthly"|"quarterly"|"annual"|"one_time"), contractStart, contractEnd
//   subscription: monthlyAmount, billingCycle, renewalDate
// All types share: type, name, entity, categoryId, activeFlag.

export async function getExpenseAgreements() {
  const snap = await getDocs(collection(db, "expenseAgreements"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addExpenseAgreement(fields) {
  const ref = await addDoc(collection(db, "expenseAgreements"), { ...fields, createdAt: Timestamp.now() });
  return ref.id;
}

export async function updateExpenseAgreement(id, fields) {
  await setDoc(doc(db, "expenseAgreements", id), fields, { merge: true });
}

export async function removeExpenseAgreement(id) {
  await deleteDoc(doc(db, "expenseAgreements", id));
}

// An agreement "covers" a budget year if activeFlag is true and, for types
// with date ranges, the year falls within [start, end] (or start with no
// end = ongoing). Subscriptions/consultants on "monthly" frequency with no
// explicit end are treated as ongoing (renewalDate is informational, not a
// hard cutoff, since a subscription auto-renewing is the common case).
function agreementCoversYear(agreement, year) {
  if (!agreement.activeFlag) return false;
  const yearStart = new Date(year, 0, 1), yearEnd = new Date(year, 11, 31);
  const start = agreement.leaseStart || agreement.contractStart;
  const end = agreement.leaseEnd || agreement.contractEnd;
  if (start && new Date(start) > yearEnd) return false;
  if (end && new Date(end) < yearStart) return false;
  return true;
}

// Which month (1-12) a rent escalation kicks in for the given budget year,
// or null if there's no trigger this year (flat, unescalated). Priority:
// contract renewal (month after leaseEnd, if leaseEnd falls in this year)
// over the lease's annual anniversary (leaseStart's month, once at least
// one full year has passed) — a renewal is a more specific/deliberate
// trigger than a generic anniversary.
function rentEscalationTriggerMonth(agreement, year) {
  if (agreement.leaseEnd) {
    const end = new Date(agreement.leaseEnd);
    if (end.getFullYear() === year && end.getMonth() < 11) return end.getMonth() + 2; // month after leaseEnd, 1-indexed
    // leaseEnd in December -> renewal lands in January of NEXT year, not this one.
  }
  if (agreement.leaseStart) {
    const start = new Date(agreement.leaseStart);
    if (year > start.getFullYear()) return start.getMonth() + 1; // annual anniversary month, 1-indexed
  }
  return null;
}

// ---- Growth assumptions ---------------------------------------------------
// One growth% per category, versioned per budget year (spec §4/§7) — not
// restricted to only the active budgeting year, since these are forward-
// looking inputs someone may want to set ahead of time.

export async function getGrowthAssumptions(year) {
  const snap = await getDocs(collection(db, "growthAssumptions", String(year), "categories"));
  const out = {};
  snap.docs.forEach(d => { out[d.id] = d.data().growthPct || 0; });
  return out;
}

export async function setGrowthAssumption(year, categoryId, growthPct) {
  await setDoc(doc(db, "growthAssumptions", String(year), "categories", categoryId), { growthPct }, { merge: true });
}

// ---- Budget generation engine ---------------------------------------------
// Precedence per spec §4: agreement-driven (if an active agreement exists
// for the category) > trend-driven (last year's actual × growth%,
// distributed using last year's own monthly shape — confirmed decision) >
// nothing (category has neither actuals nor an agreement — skipped, not
// zeroed, so it doesn't clutter the budget with empty rows).
//
// Generates one budget line per category/subcategory LEAF — i.e. whichever
// node actual accounts are directly mapped to (matching how the rollup
// view already isolates direct-vs-rolled-up totals), not one per top-level
// category. This avoids double-counting when a category has subcategories.
//
// Only valid for the active budgeting year — callers must check
// isEditableYear themselves (same pattern as vendor budgeting) before
// calling this, since it writes to otherExpensesBudget/{year}.
export async function generateOtherExpensesBudget(year) {
  const [lastYearRollup, agreements, growthAssumptions] = await Promise.all([
    getCategoryRollup(year - 1),
    getExpenseAgreements(),
    getGrowthAssumptions(year),
  ]);

  // Flatten the rollup into leaf nodes (top-level categories with no
  // subcategories, AND every subcategory) — each carries its own DIRECT
  // monthly actuals (not rolled up from children), which is what "last
  // year's shape" should be built from.
  const leaves = [];
  for (const cat of lastYearRollup) {
    if (cat.subcategories && cat.subcategories.length > 0) {
      for (const sub of cat.subcategories) leaves.push({ categoryId: cat.id, subcategoryId: sub.id, lineId: sub.id, monthly: sub.monthly, total: sub.total });
    } else {
      leaves.push({ categoryId: cat.id, subcategoryId: null, lineId: cat.id, monthly: cat.monthly, total: cat.total });
    }
  }

  const numFor = (v) => Number(v) || 0;
  const batchWrites = [];
  let agreementDriven = 0, trendDriven = 0, skipped = 0;

  for (const leaf of leaves) {
    const targetCategoryId = leaf.subcategoryId || leaf.categoryId;
    const activeAgreement = agreements.find(a => a.categoryId === targetCategoryId && agreementCoversYear(a, year));

    let monthlyAmount, source;
    if (activeAgreement) {
      source = "agreement";
      if (activeAgreement.type === "rent") {
        // Mid-year escalation: flat at the current rate up to the
        // escalation trigger month, then bumped by escalationPct from
        // that month onward — not a flat annual uplift across all 12
        // months. Trigger is either the month after leaseEnd (contract
        // renewal, if that falls within this year) or the lease's annual
        // anniversary month (if this year is at least one full year past
        // leaseStart). No trigger this year = flat, unescalated.
        const base = numFor(activeAgreement.monthlyRent);
        const escalated = base * (1 + numFor(activeAgreement.escalationPct) / 100);
        const triggerMonth = rentEscalationTriggerMonth(activeAgreement, year); // 1-12, or null
        monthlyAmount = new Array(12).fill(0).map((_, i) => (triggerMonth && i + 1 >= triggerMonth ? escalated : base));
      } else if (activeAgreement.type === "subscription") {
        monthlyAmount = new Array(12).fill(numFor(activeAgreement.monthlyAmount));
      } else { // consultant
        const fee = numFor(activeAgreement.fee);
        const annual = activeAgreement.frequency === "quarterly" ? fee * 4
          : activeAgreement.frequency === "annual" ? fee
          : activeAgreement.frequency === "one_time" ? fee
          : fee * 12; // monthly
        if (activeAgreement.frequency === "one_time") {
          // Lands in oneTimeMonth (1-12, e.g. a Dec statutory audit fee)
          // instead of always defaulting to January.
          monthlyAmount = new Array(12).fill(0);
          const m = Math.min(12, Math.max(1, numFor(activeAgreement.oneTimeMonth) || 1));
          monthlyAmount[m - 1] = annual;
        } else {
          monthlyAmount = new Array(12).fill(annual / 12); // flat distribution — agreements don't have a "shape" the way trend-based categories do
        }
      }
      agreementDriven++;
    } else if (leaf.total > 0) {
      source = "trend";
      const growthPct = growthAssumptions[targetCategoryId] || 0;
      const thisYearTotal = leaf.total * (1 + growthPct / 100);
      // Last year's own monthly shape (% of its own total per month),
      // applied to this year's grown total — confirmed decision.
      monthlyAmount = leaf.monthly.map(m => (leaf.total ? (m / leaf.total) * thisYearTotal : 0));
      trendDriven++;
    } else {
      skipped++;
      continue; // no agreement and no prior-year actuals to trend from — nothing to generate
    }

    batchWrites.push({
      lineId: leaf.lineId, categoryId: leaf.categoryId, subcategoryId: leaf.subcategoryId,
      monthlyAmount, systemEstimate: monthlyAmount, source,
    });
  }

  const writeBatchObj = writeBatch(db);
  const yearRef = collection(db, "otherExpensesBudget", String(year), "lines");
  for (const line of batchWrites) {
    writeBatchObj.set(doc(yearRef, line.lineId), {
      categoryId: line.categoryId, subcategoryId: line.subcategoryId,
      monthlyAmount: line.monthlyAmount, systemEstimate: line.systemEstimate,
      source: line.source, generatedAt: Timestamp.now(),
    });
  }
  await writeBatchObj.commit();

  return { linesGenerated: batchWrites.length, agreementDriven, trendDriven, skipped };
}

// ---- Budget lines (read + manual override) --------------------------------

export async function getOtherExpensesBudget(year) {
  const snap = await getDocs(collection(db, "otherExpensesBudget", String(year), "lines"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Manual override — per spec §4, the system estimate is retained even
// after this, never overwritten by an edit. Caller must check
// isEditableYear before calling this (same pattern as vendor budgeting).
export async function overrideOtherExpensesBudgetLine(year, lineId, monthIndex, amount, editedByEmail) {
  const ref = doc(db, "otherExpensesBudget", String(year), "lines", lineId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? snap.data() : { monthlyAmount: new Array(12).fill(0), systemEstimate: new Array(12).fill(0), source: "manual" };
  const monthlyAmount = [...(current.monthlyAmount || new Array(12).fill(0))];
  monthlyAmount[monthIndex] = amount;
  await setDoc(ref, {
    ...current, monthlyAmount,
    source: current.source === "manual" ? "manual" : `${current.source}+manual`,
    lastEditedBy: editedByEmail, lastEditedAt: Timestamp.now(),
  }, { merge: true });
}