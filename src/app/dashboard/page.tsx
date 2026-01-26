import AppLayout from "@/components/app-layout";
import ScheduleView from "@/components/dashboard/schedule-view";

export default function DashboardPage() {
  return (
    <AppLayout>
        <div className="w-full">
            <ScheduleView />
        </div>
    </AppLayout>
  );
}
