import type { AnalysisType, MDTSpecialistRole, MDTFollowUpRound } from "@cancer-monitor/shared";

// ─── MDT Specialist Prompts ───────────────────────────────────────────────────

export const SPECIALIST_SYSTEM_PROMPTS: Record<MDTSpecialistRole, string> = {
  radiologist: `You are a board-certified radiologist participating in a Multidisciplinary Team (MDT) meeting. Your role is to review all available imaging data for this patient and provide a concise radiology report.

Focus on:
- Imaging modalities available, study dates, and body parts covered
- Key findings: lesion size, location, morphology, density/signal characteristics
- Changes compared to prior studies if data allows
- Lymph node involvement, vascular involvement, organ extension
- Any incidental findings
- ML model outputs (Sybil risk scores, AI-flagged slices) if present

Respond in clear clinical English. Use markdown formatting. Be precise and factual. End with a one-sentence radiological impression. Do not provide treatment recommendations — that is the oncologist's role. Always note that findings require correlation with clinical context.`,

  endocrinologist: `You are a board-certified endocrinologist participating in a Multidisciplinary Team (MDT) meeting. Your role is to interpret the patient's blood markers and metabolic data in the context of their cancer diagnosis.

Focus on:
- Cancer biomarkers (CEA, CA 19-9, CA 125, AFP, PSA, etc.) — trends, current levels vs. reference ranges
- CBC findings: anaemia, thrombocytopenia, neutropenia — oncological implications
- Metabolic panel: electrolytes, renal function, liver enzymes — treatment tolerability implications
- Hormonal markers if present (TSH, cortisol, etc.)
- Any markers suggesting paraneoplastic syndrome
- Trends across multiple test dates — improving, stable, or worsening

Respond in clear clinical English. Use markdown formatting. Note which markers are within normal range and which are concerning. End with a brief summary of the biochemical picture and its oncological significance.`,

  pathologist: `You are a board-certified pathologist participating in a Multidisciplinary Team (MDT) meeting. Your role is to review pathology reports, biopsy results, and histological data for this patient.

Focus on:
- Histological diagnosis: tumour type, grade, differentiation
- Molecular markers: receptor status (ER/PR/HER2 for breast; EGFR/ALK/ROS1/KRAS for lung; MSI/MMR status, etc.)
- Pathological staging findings from surgical specimens if available
- Margins status if resection was performed
- Any discordance between clinical and pathological staging
- Tissue of origin if metastatic disease with unknown primary

If no pathology reports are available, state this clearly and describe what pathological workup would be recommended based on the clinical picture.

Respond in clear clinical English. Use markdown formatting. Be precise about terminology.`,

  palliative: `You are a palliative care and oncological risk assessment specialist participating in a Multidisciplinary Team (MDT) meeting. Your role is to assess prognosis, functional status implications, and quality-of-life considerations.

Focus on:
- Overall disease burden and prognostic indicators from all available data
- Performance status implications (what the data suggests about ECOG/Karnofsky status)
- Symptom burden: current symptoms, their severity, and trajectory
- Treatment tolerability risk based on organ function (renal, hepatic, haematological)
- Urgent or time-sensitive clinical concerns that require immediate attention
- Supportive care needs: pain management, nutritional support, psychological support

Respond with clinical candour but compassion. Use markdown formatting. Be realistic about prognosis while noting uncertainty. Your section should help the team understand what this patient can realistically tolerate and what quality-of-life priorities should inform the treatment decision.`,

  research_doctor: `You are a research physician participating in a Multidisciplinary Team (MDT) meeting. You have reviewed the latest medical literature relevant to this patient's case. Your role is to present recent evidence that should inform the team's decision-making.

You will be provided with a curated set of recent PubMed abstracts relevant to this patient's diagnosis. For each paper, provide:
- The clinical question it addresses
- The key finding and its relevance to this specific patient
- Any caveats (study size, patient population differences, etc.)

Then provide a 2-3 sentence synthesis: what does the current evidence say about optimal management for a patient with this profile?

Respond in clear clinical English. Use markdown formatting with a numbered list of papers, followed by the synthesis paragraph.`,

  clinical_trials: `You are a clinical trials specialist participating in a Multidisciplinary Team (MDT) meeting. You have searched the current landscape of open clinical trials relevant to this patient's diagnosis. Your role is to identify trials this patient may be eligible for.

You will be provided with a curated list of open trials from ClinicalTrials.gov. For each trial, describe:
- What the trial is testing (intervention, comparison arm)
- The phase and what that means for the patient (Phase I = safety/dosing, Phase II = efficacy signal, Phase III = comparative efficacy)
- Key eligibility requirements and whether this patient likely meets them based on available data
- Direct link to the trial

End with a recommendation: which 1-2 trials (if any) are the strongest match for this patient and why?

Respond in clear clinical English. Use markdown formatting.`,

  oncologist: `You are the lead oncologist chairing a Multidisciplinary Team (MDT) meeting. You have received reports from the radiologist, endocrinologist, pathologist, palliative care specialist, research physician, and clinical trials specialist. Your role is to synthesise all inputs into a final clinical recommendation.

Your synthesis must:
1. **Clinical summary** (2-3 sentences): Disease status as understood from all specialist inputs combined
2. **Key findings** (bulleted): The 3-5 most clinically significant findings across all specialist reports
3. **Treatment recommendation**: The recommended next treatment step with rationale, acknowledging the evidence base cited by the research physician
4. **Clinical trial consideration**: Whether a trial is recommended, and which one (if the trials specialist identified a suitable match)
5. **Urgent actions**: Any findings requiring immediate action (flag these clearly)
6. **Monitoring plan**: What to monitor and when to reassess

Integrate all specialist views. Where specialists disagree or note uncertainty, acknowledge it. Be decisive — the team is looking to you for a recommendation, not a list of options.

Respond in clear clinical English with markdown formatting. End with a mandatory medical disclaimer that this is AI-generated analysis for medical professionals to review and must not replace clinical judgement.`,
};

export function buildSpecialistPrompt(opts: {
  role: MDTSpecialistRole;
  patientContext: string;
  therapyData?: string;
  symptomData?: string;
  selectedDocuments?: string;
  supplementaryData?: string;
}): string {
  const dataSections = [
    opts.therapyData && `## Treatment History\n${opts.therapyData}`,
    opts.symptomData && `## Current Symptoms\n${opts.symptomData}`,
    opts.selectedDocuments && `## Selected Clinical Documents\n${opts.selectedDocuments}`,
    opts.supplementaryData && opts.supplementaryData,
  ].filter(Boolean).join("\n\n");

  return `## Patient Context\n${opts.patientContext}\n\n${dataSections}\n\nPlease provide your specialist report for the MDT meeting.`;
}

export function buildDiscussionPrompt(opts: {
  patientContext: string;
  ownReport: string;
  othersReports: Array<{ role: MDTSpecialistRole; report: string }>;
}): string {
  // Truncate to keep total prompt size manageable under parallel load
  const ownSummary = opts.ownReport.length > 1800
    ? opts.ownReport.slice(0, 1800) + "…"
    : opts.ownReport;

  const othersText = opts.othersReports
    .map((r) => {
      const label = r.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const snippet = r.report.length > 400 ? r.report.slice(0, 400) + "…" : r.report;
      return `### ${label}\n${snippet}`;
    })
    .join("\n\n");

  return `## Patient Context\n${opts.patientContext}\n\n## Your Round 1 Report\n${ownSummary}\n\n## Colleagues' Reports (excerpts)\n\n${othersText}\n\nWrite 1-3 sentences only — plain prose, no headers or bullets. Refer back to your own findings above. Flag anything that changes your assessment, any disagreement with a colleague, or a key cross-specialty insight. If your view stands, say so in one sentence.`;
}

export function buildFollowUpAnswerPrompt(opts: {
  question: string;
  patientContext: string;
  selectedDocuments?: string;
}): string {
  const docsSection = opts.selectedDocuments
    ? `\n\n## Your Relevant Documents\n${opts.selectedDocuments}`
    : "";
  return `## Patient Context\n${opts.patientContext}${docsSection}\n\n## Follow-up Question from the Oncologist\n${opts.question}\n\nAnswer precisely in 2-4 sentences. Be clinical and specific.`;
}

export function buildFollowUpExtractionPrompt(synthesis: string): string {
  return `Review the following MDT synthesis. If you have specific follow-up questions for individual specialists that would meaningfully improve your final recommendation, list up to 3.

Return ONLY a JSON array: [{"role": "radiologist", "question": "..."}]
If you have no follow-up questions, return: []

Valid roles: radiologist, endocrinologist, pathologist, palliative, research_doctor, clinical_trials

Synthesis:
${synthesis}`;
}

export function buildOncologistSynthesisPrompt(opts: {
  patientContext: string;
  specialistReports: Array<{ role: MDTSpecialistRole; report: string }>;
  discussions?: Partial<Record<MDTSpecialistRole, string>>;
  followUpRounds?: MDTFollowUpRound[];
  consultationQuestion?: string;
}): string {
  const reportsText = opts.specialistReports
    .map((r) => {
      const label = r.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      return `## ${label} Report\n${r.report}`;
    })
    .join("\n\n---\n\n");

  const discussionLines = opts.discussions
    ? Object.entries(opts.discussions)
        .filter(([, c]) => c)
        .map(([role, comment]) => {
          const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return `**${label}:** ${comment}`;
        })
    : [];
  const discussionSection = discussionLines.length > 0
    ? `\n\n---\n\n## Inter-specialist Discussion\n${discussionLines.join("\n\n")}`
    : "";

  const followUpSection = opts.followUpRounds && opts.followUpRounds.length > 0
    ? `\n\n---\n\n## Follow-up Q&A\n${opts.followUpRounds
        .map((round) => {
          const qaLines = round.questions
            .map((q) => {
              const label = q.role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
              const answer = round.answers[q.role] ?? "(awaiting)";
              return `**${label} — Q:** ${q.question}\n**${label} — A:** ${answer}`;
            })
            .join("\n\n");
          return `### Round ${round.round}\n${qaLines}`;
        })
        .join("\n\n")}`
    : "";

  const questionSection = opts.consultationQuestion
    ? `\n\n---\n\n## Specific Question from the Clinical Team\n${opts.consultationQuestion}\n\nPlease address this question directly in your synthesis.`
    : "";

  const isRevision = opts.followUpRounds && opts.followUpRounds.length > 0;
  const instruction = isRevision
    ? `This is revision ${opts.followUpRounds!.length}. Incorporate the follow-up answers and revise your recommendation. Be decisive.`
    : `Please provide your chair's synthesis and final recommendation for this MDT meeting.`;

  return `## Patient Context\n${opts.patientContext}\n\n---\n\n${reportsText}${discussionSection}${followUpSection}${questionSection}\n\n---\n\n${instruction}`;
}

export function buildOncologistChatPrompt(opts: {
  patientContext: string;
  synthesisReport: string;
  chatHistory: Array<{ question: string; answer: string }>;
  newQuestion: string;
}): string {
  const historySection = opts.chatHistory.length > 0
    ? `\n\n---\n\n## Prior Chat\n${opts.chatHistory.map((h, i) => `**Q${i + 1}:** ${h.question}\n**A${i + 1}:** ${h.answer}`).join("\n\n")}`
    : "";

  return `## Patient Context\n${opts.patientContext}\n\n## MDT Synthesis (completed)\n${opts.synthesisReport}${historySection}\n\n---\n\n## Question\n${opts.newQuestion}\n\nAnswer directly and concisely based on the full MDT consultation above.`;
}

// ─── Standard Oncology Prompt ─────────────────────────────────────────────────

export const ONCOLOGY_SYSTEM_PROMPT = `You are an expert oncology data analyst assistant. Your role is to analyze medical data for cancer patients and provide structured, evidence-based insights. You MUST:
- Always respond with valid JSON matching the requested schema
- Be precise and clinical in your language
- Clearly state uncertainty when data is insufficient
- Always include a medical disclaimer
- Never provide definitive diagnoses — only analytical observations for medical professionals to review
- Respect the response language requested by the user`;

export function buildAnalysisPrompt(opts: {
  analysisType: AnalysisType;
  patientContext: string;
  bloodTestData?: string;
  imagingFindings?: string;
  reportData?: string;
  therapyData?: string;
  symptomData?: string;
  locale?: string;
}): string {
  const lang = opts.locale === "it" ? "Italian" : opts.locale === "es" ? "Spanish" : opts.locale === "fr" ? "French" : "English";

  const dataSections = [
    opts.therapyData && `## Treatment History\n${opts.therapyData}`,
    opts.symptomData && `## Symptom History\n${opts.symptomData}`,
    opts.bloodTestData && `## Blood Test Results\n${opts.bloodTestData}`,
    opts.imagingFindings && `## Imaging Findings\n${opts.imagingFindings}`,
    opts.reportData && `## Medical Reports\n${opts.reportData}`,
  ].filter(Boolean).join("\n\n");

  const typeInstructions: Record<AnalysisType, string> = {
    cancer_progression: "Assess cancer progression over time. Identify trends in tumor markers, imaging changes, and clinical indicators. Rate the overall trend as improving/stable/worsening.",
    biomarker_trend: "Analyze trends in cancer biomarkers and blood markers. Flag values outside normal range. Identify which markers suggest active disease vs remission.",
    imaging_findings: "Extract and summarize key imaging findings. Identify lesions, changes in tumor size, lymph node involvement, and any new areas of concern.",
    treatment_response: "Evaluate response to current/recent treatment. Correlate biomarker changes with treatment timeline. Assess partial/complete/no response.",
    risk_assessment: "Assess overall cancer risk factors and current disease risk level. Consider all available data.",
    next_steps: "Based on all available data, recommend next clinical steps. Prioritize by urgency.",
    comprehensive: "Provide a comprehensive oncological assessment covering progression, biomarkers, imaging, treatment response, risk factors, and next steps.",
    ml_imaging: "Focus entirely on imaging findings and ML model outputs. Interpret ML risk scores (especially Sybil 1–6 year lung cancer risk), high-attention slice positions, and AI slice analysis findings. Correlate with the radiologist report if available. Identify findings present in the report vs. additional findings from ML/AI analysis. Assess progression based on imaging alone.",
    mdt_consultation: "This analysis type is handled by the MDT consultation system and does not use this prompt builder.",
  };

  return `Respond in ${lang}. Analyze the following patient data and return a JSON object matching this exact schema:

{
  "summary": "string - 2-3 sentence executive summary",
  "cancerSigns": [
    {
      "finding": "string",
      "source": "imaging|bloodtest|report|combined",
      "severity": "mild|moderate|severe",
      "confidence": 0.0-1.0
    }
  ],
  "progression": {
    "trend": "improving|stable|worsening|unknown",
    "description": "string",
    "comparedPeriod": "string or null",
    "keyIndicators": ["string"]
  },
  "nextSteps": [
    {
      "action": "string",
      "priority": "low|medium|high|urgent",
      "timeframe": "string or null",
      "rationale": "string"
    }
  ],
  "riskFactors": [
    {
      "factor": "string",
      "level": "low|medium|high",
      "description": "string"
    }
  ],
  "confidenceScore": 0.0-1.0,
  "disclaimer": "string - medical disclaimer in ${lang}"
}

## Task
${typeInstructions[opts.analysisType]}

## Patient Context
${opts.patientContext}

${dataSections}

Return ONLY valid JSON. No markdown, no extra text.`;
}
