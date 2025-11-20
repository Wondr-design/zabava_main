export function downloadBase64File(base64: string, filename: string, contentType: string) {
  try {
    const link = document.createElement("a");
    link.href = `data:${contentType};base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    // no-op
  }
}
