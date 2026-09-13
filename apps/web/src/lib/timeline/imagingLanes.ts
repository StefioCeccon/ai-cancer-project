import {
  RADIOGRAPHY_LANE_KEY,
  RADIOGRAPHY_LANE_LABEL,
  TOMOGRAPHIES_LANE_KEY,
  TOMOGRAPHIES_LANE_LABEL,
} from "./timelineLaneKeys";

const TOMOGRAPHY_MODALITIES = new Set(["CT", "MRI", "PET"]);
const RADIOGRAPHY_MODALITIES = new Set(["XRAY"]);

export type ImagingTimelineGroup = "tomography" | "radiography" | "ultrasound" | "other";

const GROUP_LABELS: Record<ImagingTimelineGroup, string> = {
  tomography: TOMOGRAPHIES_LANE_LABEL,
  radiography: RADIOGRAPHY_LANE_LABEL,
  ultrasound: "Ultrasound",
  other: "Other Imaging",
};

export function getImagingTimelineGroup(modality: string): ImagingTimelineGroup {
  if (TOMOGRAPHY_MODALITIES.has(modality)) return "tomography";
  if (RADIOGRAPHY_MODALITIES.has(modality)) return "radiography";
  if (modality === "ULTRASOUND") return "ultrasound";
  return "other";
}

export function getImagingTimelineLane(modality: string): {
  typeKey: string;
  typeLabel: string;
  group: ImagingTimelineGroup;
} {
  const group = getImagingTimelineGroup(modality);
  if (group === "radiography") {
    return {
      typeKey: RADIOGRAPHY_LANE_KEY,
      typeLabel: RADIOGRAPHY_LANE_LABEL,
      group,
    };
  }
  if (group === "tomography") {
    return {
      typeKey: TOMOGRAPHIES_LANE_KEY,
      typeLabel: TOMOGRAPHIES_LANE_LABEL,
      group,
    };
  }
  return {
    typeKey: `imaging_group_${group}`,
    typeLabel: GROUP_LABELS[group],
    group,
  };
}

/** Human-readable modality label for event titles (not timeline lane grouping). */
export function getImagingModalityLabel(modality: string): string {
  switch (modality) {
    case "CT":
      return "CT";
    case "MRI":
      return "MRI";
    case "PET":
      return "PET";
    case "XRAY":
      return "X-ray";
    case "ULTRASOUND":
      return "Ultrasound";
    default:
      return modality;
  }
}
