import { AppShell } from "@/components/layout/AppShell";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="max-w-2xl">
        <ApiKeysSection />
      </div>
    </AppShell>
  );
}
