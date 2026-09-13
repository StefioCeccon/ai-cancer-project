export async function assertFileReadable(file: File): Promise<void> {
  try {
    await file.slice(0, 1).arrayBuffer();
  } catch {
    throw new Error(
      `"${file.name}" is no longer available. Remove it from the list and add the file again.`
    );
  }
}
