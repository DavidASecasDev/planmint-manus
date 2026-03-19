import jsPDF from 'jspdf';

let cachedFontBase64: string | null = null;

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function registerPdfFonts(pdf: jsPDF): Promise<void> {
  if (!cachedFontBase64) {
    cachedFontBase64 = await fetchFontAsBase64('/fonts/Roboto-Regular.ttf');
  }

  pdf.addFileToVFS('Roboto-Regular.ttf', cachedFontBase64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'italic');
  pdf.setFont('Roboto', 'normal');
}

export const PDF_FONT = 'Roboto';
