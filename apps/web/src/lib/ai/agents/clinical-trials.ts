import { getProvider } from "@/lib/ai/registry";
import { SPECIALIST_SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import type { AIProvider } from "@ai-cancer-project/shared";

interface CTStudy {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle: string };
    statusModule: { overallStatus: string; startDateStruct?: { date: string } };
    descriptionModule?: { briefSummary?: string };
    designModule?: { phases?: string[] };
    eligibilityModule?: { eligibilityCriteria?: string; minimumAge?: string; maximumAge?: string };
    contactsLocationsModule?: { locations?: Array<{ country?: string; city?: string }> };
  };
}

async function searchTrials(cancerType: string): Promise<CTStudy[]> {
  const query = encodeURIComponent(cancerType);
  const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${query}&filter.overallStatus=RECRUITING&pageSize=5&fields=protocolSection`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.studies as CTStudy[]) ?? [];
}

function formatTrial(study: CTStudy, index: number): string {
  const id = study.protocolSection.identificationModule;
  const status = study.protocolSection.statusModule;
  const design = study.protocolSection.designModule;
  const eligibility = study.protocolSection.eligibilityModule;
  const locations = study.protocolSection.contactsLocationsModule?.locations ?? [];
  const description = study.protocolSection.descriptionModule;

  const phase = design?.phases?.join(", ") ?? "Not specified";
  const locationStr = locations
    .slice(0, 3)
    .map((l) => [l.city, l.country].filter(Boolean).join(", "))
    .join(" | ");

  return [
    `${index + 1}. **${id.briefTitle}**`,
    `   - NCT ID: [${id.nctId}](https://clinicaltrials.gov/study/${id.nctId})`,
    `   - Phase: ${phase} | Status: ${status.overallStatus}`,
    locationStr && `   - Locations: ${locationStr}`,
    description?.briefSummary && `   - Summary: ${description.briefSummary.slice(0, 200)}...`,
    eligibility?.minimumAge && `   - Age: ${eligibility.minimumAge}${eligibility.maximumAge ? ` – ${eligibility.maximumAge}` : "+"}`,
  ].filter(Boolean).join("\n");
}

export async function runClinicalTrials(opts: {
  patientContext: string;
  cancerType: string | null;
  therapyData?: string;
  selectedDocuments?: string;
  provider: AIProvider;
  model: string;
}): Promise<string> {
  const { patientContext, cancerType, provider, model } = opts;

  let supplementaryData = "";

  try {
    const searchTerm = cancerType ?? "cancer";
    const studies = await searchTrials(searchTerm);

    if (studies.length > 0) {
      const trialLines = studies.map((s, i) => formatTrial(s, i));
      supplementaryData = `## Open Recruiting Trials — ClinicalTrials.gov\n${trialLines.join("\n\n")}`;
    } else {
      supplementaryData = `## Open Recruiting Trials\n*No recruiting trials found for "${cancerType ?? "this cancer type"}" on ClinicalTrials.gov at this time. Please note this in your report.*`;
    }
  } catch {
    supplementaryData = `## Open Recruiting Trials\n*ClinicalTrials.gov was unavailable. Please draw on your general knowledge of active trials for this indication.*`;
  }

  const aiProvider = getProvider(provider);
  if (!aiProvider) throw new Error(`Provider ${provider} not found`);

  const contextSections = [
    opts.therapyData && `## Treatment History\n${opts.therapyData}`,
    opts.selectedDocuments && `## Selected Clinical Documents\n${opts.selectedDocuments}`,
    supplementaryData,
  ].filter(Boolean).join("\n\n");

  const userPrompt = `## Patient Context\n${patientContext}\n\n${contextSections}\n\nPlease provide your clinical trials assessment for the MDT meeting.`;

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 1500,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS.clinical_trials },
      { role: "user", content: userPrompt },
    ],
  });

  return response.content;
}
