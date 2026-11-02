
"use client";

import { CheckCircle2, AlertCircle, Users } from "lucide-react";
import type { LeadParseResult } from "@/lib/csv/lead-parser";

interface LeadPreviewProps {
  result: LeadParseResult;
}

export default function LeadPreview({ result }: LeadPreviewProps) {
  const { validLeads, invalidLeads, totalRows } = result;

  if (totalRows === 0) return null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <Users className="mb-2 text-slate-500" size={20} />
          <p className="text-2xl font-bold text-slate-900">{totalRows}</p>
          <p className="text-sm text-slate-500">Total records</p>
        </div>

        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle2 className="mb-2 text-green-600" size={20} />
          <p className="text-2xl font-bold text-green-700">
            {validLeads.length}
          </p>
          <p className="text-sm text-green-700">Valid leads</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mb-2 text-red-600" size={20} />
          <p className="text-2xl font-bold text-red-700">
            {invalidLeads.length}
          </p>
          <p className="text-sm text-red-700">Invalid records</p>
        </div>
      </div>

      {validLeads.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Valid leads
            </h3>
          </div>

          <div className="max-h-64 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {validLeads.map((lead, index) => (
                  <tr key={`${lead.email}-${index}`}>
                    <td className="px-4 py-3 text-slate-700">
                      {lead.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.email}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invalidLeads.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-red-200">
          <div className="border-b border-red-200 bg-red-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-red-800">
              Invalid records
            </h3>
          </div>

          <div className="max-h-52 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {invalidLeads.map((lead, index) => (
                  <tr key={`${lead.row}-${index}`}>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.row}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-red-600">
                      {lead.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
