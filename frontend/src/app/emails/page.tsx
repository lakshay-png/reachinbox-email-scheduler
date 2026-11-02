
"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { apiRequest } from "@/lib/api";
import type {
  EmailSearchResponse,
  EmailStatus,
  SearchEmail,
} from "@/types/email";

const statuses = ["ALL", "SCHEDULED", "PROCESSING", "SENT", "FAILED"] as const;

type StatusFilter = (typeof statuses)[number];

function StatusBadge({ status }: { status: EmailStatus }) {
  const styles: Record<EmailStatus, string> = {
    SCHEDULED: "bg-amber-50 text-amber-700",
    PROCESSING: "bg-blue-50 text-blue-700",
    SENT: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<SearchEmail[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEmails = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });

      if (search.trim()) {
        params.set("q", search.trim());
      }

      if (status !== "ALL") {
        params.set("status", status);
      }

      const response = await apiRequest<EmailSearchResponse>(
        `/api/emails/search?${params.toString()}`
      );

      setEmails(response.data);
      setTotal(response.pagination.total);
      setTotalPages(response.pagination.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails.");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEmails();
    }, 300);

    return () => clearTimeout(timer);
  }, [loadEmails]);

  function changeStatus(value: StatusFilter) {
    setStatus(value);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <DashboardLayout
      title="All Emails"
      description="Search, filter and manage your email activity."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Search email subjects and content..."
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            onClick={() => void loadEmails()}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {statuses.map((item) => (
            <button
              key={item}
              onClick={() => changeStatus(item)}
              className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                status === item
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item === "ALL" ? "All Emails" : item.charAt(0) + item.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {error && (
            <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">
              Loading emails...
            </div>
          ) : !error && emails.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-500">
              No emails match your search.
            </div>
          ) : !error ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Recipient</th>
                      <th className="px-6 py-4 font-medium">Subject</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Scheduled At</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {emails.map((email) => (
                      <tr key={email.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-800">
                          {email.recipient}
                        </td>
                        <td className="max-w-xs truncate px-6 py-4 text-slate-600">
                          {email.subject}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <StatusBadge status={email.status} />
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                          {formatDate(email.scheduledAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-500">
                  {total === 0
                    ? "No results"
                    : `Showing ${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total} emails`}
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1 || loading}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <span className="text-sm text-slate-600">
                    Page {page} of {Math.max(1, totalPages)}
                  </span>

                  <button
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages || loading || totalPages === 0}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
