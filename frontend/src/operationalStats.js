/**
 * Operational Stats — invoice-level metrics computed from the raw
 * ciprActuals/{year}/invoices collection (same data source queryInvoices
 * uses for the chatbot). Multi-year trend + "new this year" both need
 * every year from 2023 through the selected year fetched, since "new"
 * means "not seen in any prior year" — computed client-side by comparing
 * the selected year's entities against the union of everything before it.
 */
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase.js";

const db = getFirestore(app);

async function getInvoicesForYear(year) {
  const snap = await getDocs(collection(db, "ciprActuals", String(year), "invoices"));
  return snap.docs.map(d => d.data());
}

// Returns { [year]: invoiceRow[] } for every year from startYear through
// selectedYear. Years with nothing synced yet just come back empty
// (caught, not thrown) rather than failing the whole fetch.
export async function getInvoicesByYearRange(selectedYear, startYear = 2023) {
  const years = [];
  for (let y = startYear; y <= selectedYear; y++) years.push(y);
  const results = await Promise.all(years.map(y => getInvoicesForYear(y).catch(() => [])));
  const byYear = {};
  years.forEach((y, i) => { byYear[y] = results[i]; });
  return byYear;
}

const uniqueValues = (rows, field) => new Set(rows.map(r => r[field]).filter(Boolean));

const REVENUE_BUCKETS = [
  { label: "$1M+", min: 1000000, max: Infinity },
  { label: "$500K–1M", min: 500000, max: 1000000 },
  { label: "$100K–500K", min: 100000, max: 500000 },
  { label: "$50K–100K", min: 50000, max: 100000 },
  { label: "<$50K", min: -Infinity, max: 50000 },
];
const GP_PCT_BUCKETS = [
  { label: "20%+", min: 0.20, max: Infinity },
  { label: "15–20%", min: 0.15, max: 0.20 },
  { label: "10–15%", min: 0.10, max: 0.15 },
  { label: "5–10%", min: 0.05, max: 0.10 },
  { label: "0–5%", min: 0, max: 0.05 },
  { label: "Negative", min: -Infinity, max: 0 },
];

export function computeOperationalStats(byYear, selectedYear) {
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const selected = byYear[selectedYear] || [];

  // "New this year" = present in the selected year but not in the union
  // of every prior year — invoice-level identity (vendor/customer/end
  // customer/country names), not a separate "first seen" flag stored
  // anywhere.
  const priorRows = years.filter(y => y < selectedYear).flatMap(y => byYear[y]);
  const priorVendors = uniqueValues(priorRows, "vendorName");
  const priorCustomers = uniqueValues(priorRows, "customerName");
  const priorEndCustomers = uniqueValues(priorRows, "endCustomer");
  const priorCountries = uniqueValues(priorRows, "billingCountry");

  const selVendors = uniqueValues(selected, "vendorName");
  const selCustomers = uniqueValues(selected, "customerName");
  const selEndCustomers = uniqueValues(selected, "endCustomer");
  const selCountries = uniqueValues(selected, "billingCountry");

  const newVendors = [...selVendors].filter(v => !priorVendors.has(v)).length;
  const newCustomers = [...selCustomers].filter(v => !priorCustomers.has(v)).length;
  const newEndCustomers = [...selEndCustomers].filter(v => !priorEndCustomers.has(v)).length;
  const newCountries = [...selCountries].filter(v => !priorCountries.has(v)).length;

  const totalRevenue = selected.reduce((s, r) => s + (r.revenue || 0), 0);
  const invoiceCount = selected.length;
  const avgDealSize = invoiceCount ? totalRevenue / invoiceCount : 0;
  const dealsAbove20Margin = selected.filter(r => r.revenue > 0 && (r.gp / r.revenue) > 0.20).length;

  const revenueBuckets = REVENUE_BUCKETS.map(b => {
    const matching = selected.filter(r => r.revenue >= b.min && r.revenue < b.max);
    return { label: b.label, count: matching.length, revenue: Math.round(matching.reduce((s, r) => s + r.revenue, 0)) };
  });

  const gpBuckets = GP_PCT_BUCKETS.map(b => {
    const matching = selected.filter(r => r.revenue !== 0 && (r.gp / r.revenue) >= b.min && (r.gp / r.revenue) < b.max);
    return { label: b.label, count: matching.length, revenue: Math.round(matching.reduce((s, r) => s + r.revenue, 0)) };
  });

  const segmentMap = {};
  for (const r of selected) {
    const seg = r.ztxFramework || "(unspecified)";
    if (!segmentMap[seg]) segmentMap[seg] = { revenue: 0, count: 0 };
    segmentMap[seg].revenue += r.revenue || 0;
    segmentMap[seg].count++;
  }
  const segments = Object.entries(segmentMap)
    .map(([name, v]) => ({ name, revenue: Math.round(v.revenue), count: v.count }))
    .sort((a, b) => b.revenue - a.revenue);

  const trend = years.map(y => {
    const rows = byYear[y];
    return {
      year: String(y),
      Invoices: rows.length,
      Vendors: uniqueValues(rows, "vendorName").size,
      Customers: uniqueValues(rows, "customerName").size,
      "End Customers": uniqueValues(rows, "endCustomer").size,
      Countries: uniqueValues(rows, "billingCountry").size,
    };
  });

  return {
    invoiceCount, vendorCount: selVendors.size, customerCount: selCustomers.size,
    endCustomerCount: selEndCustomers.size, countryCount: selCountries.size,
    newVendors, newCustomers, newEndCustomers, newCountries,
    avgDealSize, dealsAbove20Margin,
    revenueBuckets, gpBuckets, segments, trend,
  };
}