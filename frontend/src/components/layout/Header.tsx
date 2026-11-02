
"use client";

import {
  Search,
  Bell,
  Plus,
} from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
  onScheduleClick?: () => void;
}

export default function Header({
  title,
  description,
  onScheduleClick,
}: HeaderProps) {
  return (
    <header className="flex flex-col justify-between gap-5 border-b border-slate-200 bg-white px-8 py-6 md:flex-row md:items-center">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {description}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            placeholder="Search emails..."
            className="w-56 rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"
        >
          <Bell size={18} />
        </button>

        <button
          type="button"
          onClick={onScheduleClick}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus size={17} />
          Schedule Email
        </button>
      </div>
    </header>
  );
}
