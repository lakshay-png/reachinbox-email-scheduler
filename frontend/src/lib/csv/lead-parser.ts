
import Papa from "papaparse";

export interface Lead {
  name: string;
  email: string;
}

export interface InvalidLead {
  row: number;
  name: string;
  email: string;
  reason: string;
}

export interface LeadParseResult {
  validLeads: Lead[];
  invalidLeads: InvalidLead[];
  totalRows: number;
}

interface CSVRow {
  name?: string;
  email?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function parseLeadCSV(
  file: File
): Promise<LeadParseResult> {
  const csvText = await file.text();

  const results = Papa.parse<CSVRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  if (results.errors.length > 0) {
    throw new Error(
      `CSV parsing failed: ${results.errors[0].message}`
    );
  }

  if (!results.meta.fields?.includes("email")) {
    throw new Error('CSV must contain an "email" column.');
  }

  const validLeads: Lead[] = [];
  const invalidLeads: InvalidLead[] = [];
  const seenEmails = new Set<string>();

  results.data.forEach((row, index) => {
    const name = (row.name || "").trim();
    const email = (row.email || "").trim().toLowerCase();
    const rowNumber = index + 2;

    if (!email) {
      invalidLeads.push({
        row: rowNumber,
        name,
        email,
        reason: "Email address is missing.",
      });
      return;
    }

    if (!isValidEmail(email)) {
      invalidLeads.push({
        row: rowNumber,
        name,
        email,
        reason: "Invalid email address.",
      });
      return;
    }

    if (seenEmails.has(email)) {
      invalidLeads.push({
        row: rowNumber,
        name,
        email,
        reason: "Duplicate email address.",
      });
      return;
    }

    seenEmails.add(email);
    validLeads.push({ name, email });
  });

  return {
    validLeads,
    invalidLeads,
    totalRows: results.data.length,
  };
}

