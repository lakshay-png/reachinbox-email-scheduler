
"use client";

import { ReactNode, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ScheduleEmailModal from "../dashboard/ScheduleEmailModal";
import ProtectedRoute from "../auth/ProtectedRoute";

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
}

export default function DashboardLayout({
  children,
  title,
  description,
}: DashboardLayoutProps) {
  const [scheduleOpen, setScheduleOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50">
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        <main className="min-w-0 flex-1">
          <Header
            title={title}
            description={description}
            onScheduleClick={() => setScheduleOpen(true)}
          />

          <div className="p-6 md:p-8">
            {children}
          </div>
        </main>

        {scheduleOpen && (
          <ScheduleEmailModal
            onClose={() => setScheduleOpen(false)}
            onSuccess={() => window.location.reload()}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}


