import type { AnalysisSlice } from "@/lib/imaging/selectAnalysisSlices";
import type { SybilResultLike } from "@/lib/imaging/sybil";

export interface ImagingPromptContext {
  modality: string;
  bodyPart: string;
  studyDate: string;
  radiologistReport?: string | null;
  sybil?: SybilResultLike | null;
  slices: AnalysisSlice[];
}

function formatSliceList(slices: AnalysisSlice[]): string {
  return slices.map((slice, index) => {
    const sourceLabel = slice.sources.includes("manual") && slice.sources.includes("sybil")
      ? "manual + Sybil"
      : slice.sources.includes("manual")
        ? "manually flagged"
        : "Sybil high-attention";
    const seriesLabel = slice.seriesDescription
      ? `Series ${slice.seriesNumber} (${slice.seriesDescription})`
      : `Series ${slice.seriesNumber}`;
    return `${index + 1}. Image ${index + 1}: ${seriesLabel}, instance ${slice.instanceNumber} — ${sourceLabel}`;
  }).join("\n");
}

export function buildImagingSystemPrompt(modality: string): string {
  return `You are an expert radiology assistant helping review medical imaging.
- Describe observable findings clearly and conservatively
- Note uncertainty when image quality or context is limited
- Never provide a definitive diagnosis — findings are for clinician review
- Compare your observations to any provided radiology report
- Highlight findings mentioned in the report AND any additional observations
- This is ${modality} imaging; use appropriate terminology for the modality`;
}

export function buildImagingUserPrompt(ctx: ImagingPromptContext): string {
  const hasReport = !!ctx.radiologistReport?.trim();
  const reportSection = hasReport
    ? `\n\nRadiology report (compare your findings to this — note alignments and discordances):\n${ctx.radiologistReport!.trim()}`
    : "\n\nNo radiology report linked to this study — skip the comparison section or state that no report was available.";

  const sliceSection = formatSliceList(ctx.slices);

  if (ctx.modality === "CT" && ctx.sybil) {
    const score5yr = ((ctx.sybil.risk_scores["5yr"] ?? 0) * 100).toFixed(1);
    const score6yr = (ctx.sybil.risk_scores["6yr"] * 100).toFixed(1);
    return `You are reviewing CT chest slices selected for AI analysis after Sybil lung cancer risk screening.

Study: ${ctx.modality} ${ctx.bodyPart} — ${ctx.studyDate}
Sybil risk: 5-year ${score5yr}%, 6-year ${score6yr}% (${ctx.sybil.risk_level} risk)
Sybil analyzed series ${ctx.sybil.series_number ?? "unknown"}.

The attached images correspond to:
${sliceSection}

For each image, describe relevant findings: lung parenchyma, nodules or masses (size, morphology, density), pleura, airways, mediastinum, lymph nodes, and any other notable features.
Note which findings align with the radiology report vs. appear additional or discordant.${reportSection}

Respond in **Markdown** with these sections as headings:

## Summary
2–4 sentences overview.

## Findings by Slice
Reference **Image 1**, **Image 2**, etc. Use bullet lists where helpful.

## Comparison to Radiology Report
Note alignments and discordances.

## Suggested Follow-up
Any recommended next steps, or state if none.`;
  }

  if (ctx.modality === "XRAY") {
    return `You are reviewing a chest X-ray study (${ctx.bodyPart}, ${ctx.studyDate}).

Attached images:
${sliceSection}

Describe: cardiac silhouette, lung fields, costophrenic angles, mediastinum, bony structures, and any focal opacities.
Compare to the radiology report if provided.${reportSection}

Respond in **Markdown** with ## Summary, ## Findings, and ## Comparison to Report sections.`;
  }

  return `Review the following ${ctx.modality} study (${ctx.bodyPart}, ${ctx.studyDate}).

Attached images:
${sliceSection}${reportSection}

Respond in **Markdown** with ## Summary, ## Findings by Slice, and ## Comparison to Report sections.`;
}
