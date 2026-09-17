import { AppShell } from "@/components/layout/AppShell";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";

export default function SettingsPage() {
  return (
    <AppShell title="Settings">
      <div className="max-w-2xl space-y-6">
        <ApiKeysSection />
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-800">Privacy &amp; AI</h2>
          </CardHeader>
          <CardContent className="text-sm text-slate-600 space-y-2 leading-relaxed">
            <p>
              Patient records are private to your account and people you explicitly invite.
              Uploaded files require a signed-in session and membership on that patient.
            </p>
            <p>
              Chat, AI analysis, MDT, and imaging AI send the selected patient context (and
              sometimes images) to the AI provider you configure. Use providers you trust for
              that data.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
