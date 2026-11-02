
"use client";

import { FormEvent, useEffect, useState } from "react";
import { X, Loader2, Send } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ScheduleEmailPayload } from "@/types/email";

interface Sender {
  id: string;
  email: string;
  displayName: string | null;
}

interface SenderResponse {
  success: boolean;
  data: Sender[];
}

interface ScheduleResponse {
  success: boolean;
  message: string;
  duplicate: boolean;
}

interface ScheduleEmailModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function getLocalDateTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 1);
  date.setSeconds(0, 0);

  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function ScheduleEmailModal({
  onClose,
  onSuccess,
}: ScheduleEmailModalProps) {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [form, setForm] = useState<ScheduleEmailPayload>({
    senderId: "",
    recipient: "",
    subject: "",
    body: "",
    scheduledAt: getLocalDateTime(),
  });

  useEffect(() => {
    async function loadSenders() {
      try {
        const response = await apiRequest<SenderResponse>("/api/senders");

        setSenders(response.data);

        if (response.data.length > 0) {
          setForm((previous) => ({
            ...previous,
            senderId: response.data[0].id,
          }));
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load sender accounts."
        );
      } finally {
        setLoadingSenders(false);
      }
    }

    loadSenders();
  }, []);

  function handleChange(
    field: keyof ScheduleEmailPayload,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!form.scheduledAt || new Date(form.scheduledAt) <= new Date()) {
      setError("Please select a future date and time.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiRequest<ScheduleResponse>(
        "/api/emails/schedule",
        {
          method: "POST",
          headers: {
            "Idempotency-Key": crypto.randomUUID(),
          },
          body: JSON.stringify({
            ...form,
            scheduledAt: new Date(form.scheduledAt).toISOString(),
          }),
        }
      );

      setSuccessMessage(response.message);

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to schedule email."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Schedule an Email
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Compose your email and choose when it should be sent.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Sender account
            </label>

            <select
              required
              value={form.senderId}
              onChange={(event) =>
                handleChange("senderId", event.target.value)
              }
              disabled={loadingSenders || senders.length === 0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                {loadingSenders ? "Loading senders..." : "Select a sender"}
              </option>

              {senders.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.displayName || sender.email} ({sender.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Recipient email
            </label>
            <input
              type="email"
              required
              value={form.recipient}
              onChange={(event) =>
                handleChange("recipient", event.target.value)
              }
              placeholder="recipient@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              type="text"
              required
              minLength={1}
              maxLength={998}
              value={form.subject}
              onChange={(event) =>
                handleChange("subject", event.target.value)
              }
              placeholder="Enter email subject"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Email body
            </label>
            <textarea
              required
              rows={5}
              value={form.body}
              onChange={(event) => handleChange("body", event.target.value)}
              placeholder="Write your email..."
              className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Schedule date and time
            </label>
            <input
              type="datetime-local"
              required
              min={getLocalDateTime()}
              value={form.scheduledAt}
              onChange={(event) =>
                handleChange("scheduledAt", event.target.value)
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              Uses your computer&apos;s local time zone.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
              {successMessage}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                loadingSenders ||
                senders.length === 0 ||
                Boolean(successMessage)
              }
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {submitting ? "Scheduling..." : "Schedule Email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
