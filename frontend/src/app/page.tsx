
import DashboardLayout from "@/components/layout/DashboardLayout";
import DashboardOverview from "@/components/dashboard/DashboardOverview";

export default function Home() {
  return (
    <DashboardLayout
      title="Overview"
      description="Monitor your email campaigns and delivery performance."
    >
      <DashboardOverview />
    </DashboardLayout>
  );
}


