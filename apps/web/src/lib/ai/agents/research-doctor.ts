import { getProvider } from "@/lib/ai/registry";
import { SPECIALIST_SYSTEM_PROMPTS } from "@/lib/ai/prompts";
import type { AIProvider } from "@cancer-monitor/shared";

interface PubMedSummary {
  uid: string;
  title: string;
  source: string;
  pubdate: string;
  authors: Array<{ name: string }>;
}

async function searchPubMed(query: string): Promise<string[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encoded}&retmax=5&sort=relevance&retmode=json&datetype=pdat&reldate=1095`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.esearchresult?.idlist as string[]) ?? [];
}

async function fetchPubMedSummaries(pmids: string[]): Promise<PubMedSummary[]> {
  if (pmids.length === 0) return [];
  const ids = pmids.join(",");
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids}&retmode=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];
  const data = await res.json();
  return pmids
    .map((id) => data.result?.[id] as PubMedSummary | undefined)
    .filter((s): s is PubMedSummary => !!s);
}

export async function runResearchDoctor(opts: {
  patientContext: string;
  cancerType: string | null;
  therapyData?: string;
  symptomData?: string;
  selectedDocuments?: string;
  provider: AIProvider;
  model: string;
}): Promise<string> {
  const { patientContext, cancerType, provider, model } = opts;

  const baseQuery = cancerType
    ? `${cancerType} cancer treatment outcomes 2023 2024`
    : "oncology treatment outcomes 2023 2024";

  let supplementaryData = "";

  try {
    const pmids = await searchPubMed(baseQuery);
    const summaries = await fetchPubMedSummaries(pmids);

    if (summaries.length > 0) {
      const paperLines = summaries.map((s, i) => {
        const authors = s.authors?.slice(0, 2).map((a) => a.name).join(", ") ?? "Unknown";
        const authorsStr = s.authors?.length > 2 ? `${authors} et al.` : authors;
        return `${i + 1}. **${s.title}**\n   ${authorsStr} — *${s.source}*, ${s.pubdate}\n   https://pubmed.ncbi.nlm.nih.gov/${s.uid}/`;
      });
      supplementaryData = `## Recent PubMed Literature (last 3 years)\n${paperLines.join("\n\n")}`;
    } else {
      supplementaryData = `## Recent PubMed Literature\n*PubMed search returned no results for "${baseQuery}". Please note this limitation in your report and draw on your general knowledge of the field.*`;
    }
  } catch {
    supplementaryData = `## Recent PubMed Literature\n*PubMed search was unavailable. Please draw on your general knowledge of recent evidence for this cancer type.*`;
  }

  const aiProvider = getProvider(provider);
  if (!aiProvider) throw new Error(`Provider ${provider} not found`);

  const contextSections = [
    opts.therapyData && `## Treatment History\n${opts.therapyData}`,
    opts.symptomData && `## Current Symptoms\n${opts.symptomData}`,
    opts.selectedDocuments && `## Selected Clinical Documents\n${opts.selectedDocuments}`,
    supplementaryData,
  ].filter(Boolean).join("\n\n");

  const userPrompt = `## Patient Context\n${patientContext}\n\n${contextSections}\n\nPlease provide your literature review and evidence summary for the MDT meeting.`;

  const response = await aiProvider.chat({
    provider,
    model,
    temperature: 0.3,
    maxTokens: 1500,
    messages: [
      { role: "system", content: SPECIALIST_SYSTEM_PROMPTS.research_doctor },
      { role: "user", content: userPrompt },
    ],
  });

  return response.content;
}
