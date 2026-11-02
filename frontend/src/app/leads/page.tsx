
"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CSVLeadUploader from "@/components/leads/CSVLeadUploader";
import LeadPreview from "@/components/leads/LeadPreview";
import type { LeadParseResult } from "@/lib/csv/lead-parser";

const emptyResult: LeadParseResult = {
  validLeads: [],
  invalidLeads: [],
  totalRows: 0,
};

export default function LeadsPage() {
  const [result, setResult] = useState<LeadParseResult>(emptyResult);

  return (
    <DashboardLayout
      title="Lead Management"
      description="Import, validate, and manage your email leads."
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Import leads from CSV
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a CSV containing name and email columns.
            </p>
          </div>

          <CSVLeadUploader onParsed={setResult} />

          <div className="mt-5 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">
              Required CSV format
            </p>
            <code className="mt-2 block overflow-x-auto text-xs text-slate-600">
              name,email
              <br />
              Aarav Sharma,aarav@example.com
              <br />
              Priya Singh,priya@example.com
            </code>
          </div>
        </section>

        {result.totalRows > 0 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-900">
                Import preview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Review your records before proceeding with bulk scheduling.
              </p>
            </div>

            <LeadPreview result={result} />
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
