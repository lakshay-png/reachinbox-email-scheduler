
"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Mail,
  Clock3,
  Send,
  AlertCircle,
  Settings,
  Inbox,
  ChevronDown,
} from "lucide-react";

const navigation = [
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "All Emails", href: "/emails", icon: Inbox },
  { label: "Scheduled", href: "/scheduled", icon: Clock3 },
  { label: "Sent", href: "/sent", icon: Send },
  { label: "Failed", href: "/failed", icon: AlertCircle },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white px-5 py-6">
      <div className="mb-10 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <Mail size={22} />
        </div>

        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            ReachInbox
          </h1>
          <p className="text-xs text-slate-500">Email Scheduler</p>
        </div>
      </div>

      <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Workspace
      </p>

      <nav className="flex-1 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/";

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 pt-5">
        <Link
          href="/settings"
          className="mb-5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Settings size={18} />
          Settings
        </Link>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
              LK
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Demo User
              </p>
              <p className="text-xs text-slate-500">Free workspace</p>
            </div>
          </div>

          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
