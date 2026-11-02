
"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Mail,
  RefreshCw,
} from "lucide-react";

import { apiRequest } from "@/lib/api";
import type {
  Email,
  EmailDashboardResponse,
} from "@/types/email";

const statCards = [
  {
    key: "total",
    label: "Total Emails",
    icon: Mail,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "scheduled",
    label: "Scheduled",
    icon: Clock3,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "sent",
    label: "Successfully Sent",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    key: "failed",
    label: "Failed",
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
] as const;

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusBadge({ status }: { status: Email["status"] }) {
  const styles = {
    SCHEDULED: "bg-amber-50 text-amber-700",
    PROCESSING: "bg-blue-50 text-blue-700",
    SENT: "bg-emerald-50 text-emerald-700",
    FAILED: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export default function DashboardOverview() {
  const [dashboard, setDashboard] =
    useState<EmailDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const response = await apiRequest<EmailDashboardResponse>(
        "/api/emails?page=1&limit=5"
      );

      setDashboard(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.key}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {stat.label}
                </p>
                <div className={`rounded-xl p-2.5 ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>

              <p className="mt-5 text-3xl font-semibold text-slate-900">
                {loading ? "—" : dashboard?.stats[stat.key] ?? "—"}
              </p>
            </div>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Recent Email Activity
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Your latest scheduled email activity
            </p>
          </div>

          <button
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="m-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading email activity...
          </div>
        )}

        {!loading && !error && dashboard?.data.length === 0 && (
          <div className="p-10 text-center text-sm text-slate-500">
            No emails found. Schedule your first email to get started.
          </div>
        )}

        {!loading && !error && dashboard && dashboard.data.length > 0 && (
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
                {dashboard.data.map((email) => (
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
        )}
      </section>
    </div>
  );
}
