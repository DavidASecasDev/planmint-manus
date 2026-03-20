import jsPDF from 'jspdf';
import { ROBOTO_REGULAR_BASE64 } from './robotoBase64';

export async function registerPdfFonts(pdf: jsPDF): Promise<void> {
  // Use the embedded base64 font directly — no network fetch needed.
  // This avoids issues where the SPA router intercepts /fonts/* requests
  // and returns HTML instead of the actual TTF file.
  pdf.addFileToVFS('Roboto-Regular.ttf', ROBOTO_REGULAR_BASE64);
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'bold');
  pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'italic');
  pdf.setFont('Roboto', 'normal');
}

export const PDF_FONT = 'Roboto';
