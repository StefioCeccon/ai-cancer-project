/** Best-effort MIME type from filename when the browser omits `file.type`. */
export function guessMimeType(fileName: string, fallback = "application/octet-stream"): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "csv":
      return "text/csv";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "dcm":
      return "application/dicom";
    default:
      return fallback;
  }
}
