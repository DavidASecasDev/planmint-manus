import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTransferInvoiceSettings } from './useTransferInvoiceSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import type { DamageReport } from '@/types/garatech';
import { VEHICLE_LOCATIONS } from '@/types/garatech';
import { registerPdfFonts, PDF_FONT } from '@/lib/fonts/fontLoader';

export type PdfLang = 'es' | 'en';

const PDF_TRANSLATIONS = {
  es: {
    title: 'INFORME DE DAÑOS',
    client: 'CLIENTE',
    vehicle: 'VEHÍCULO',
    damageDate: 'FECHA DEL DAÑO',
    reference: 'REFERENCIA',
    reservation: 'RESERVA:',
    contract: 'CONTRATO',
    contractSep: 'al',
    docLabel: 'Doc:',
    noClient: 'No especificado',
    concept: 'Concepto',
    location: 'Ubicación',
    severity: 'Gravedad',
    qty: 'Cant.',
    unitPrice: 'Precio Ud.',
    total: 'Total',
    totalLabel: 'TOTAL',
    collected: 'Cobrado',
    pending: 'Pendiente',
    observations: 'OBSERVACIONES',
    photos: 'Fotografías de daños',
    noItems: 'Sin conceptos de daño registrados',
    imageUnavailable: 'Imagen no disponible',
    clientSignature: 'Firma del Cliente',
    companySignature: 'Firma de la Empresa',
    pdfGenerated: 'generado correctamente',
    pdfError: 'Error al generar el PDF',
    configError: 'Configura los datos de facturación primero',
    companyError: 'Falta el nombre de la empresa en la configuración',
    severityLabels: { 1: 'Leve', 2: 'Menor', 3: 'Moderado', 4: 'Importante', 5: 'Grave' } as Record<number, string>,
    severityFallback: (n: number) => `Nivel ${n}`,
    damage: 'Daño',
    taxIdLabel: 'CIF:',
    phoneLabel: 'Tel:',
    photosBefore: 'Fotografías ANTES del daño',
    photosAfter: 'Fotografías DESPUÉS del daño',
  },
  en: {
    title: 'DAMAGE REPORT',
    client: 'CLIENT',
    vehicle: 'VEHICLE',
    damageDate: 'DAMAGE DATE',
    reference: 'REFERENCE',
    reservation: 'BOOKING:',
    contract: 'CONTRACT',
    contractSep: 'to',
    docLabel: 'ID:',
    noClient: 'Not specified',
    concept: 'Concept',
    location: 'Location',
    severity: 'Severity',
    qty: 'Qty',
    unitPrice: 'Unit Price',
    total: 'Total',
    totalLabel: 'TOTAL',
    collected: 'Collected',
    pending: 'Pending',
    observations: 'OBSERVATIONS',
    photos: 'Damage Photographs',
    noItems: 'No damage items recorded',
    imageUnavailable: 'Image unavailable',
    clientSignature: 'Client Signature',
    companySignature: 'Company Signature',
    pdfGenerated: 'generated successfully',
    pdfError: 'Error generating PDF',
    configError: 'Configure billing details first',
    companyError: 'Company name missing in configuration',
    severityLabels: { 1: 'Minor', 2: 'Low', 3: 'Moderate', 4: 'Significant', 5: 'Severe' } as Record<number, string>,
    severityFallback: (n: number) => `Level ${n}`,
    damage: 'Damage',
    taxIdLabel: 'Tax ID:',
    phoneLabel: 'Phone:',
    photosBefore: 'Photographs BEFORE the damage',
    photosAfter: 'Photographs AFTER the damage',
  },
} as const;

// Premium Color Palette
const COLORS = {
  navy: [13, 33, 55] as [number, number, number],
  navyLight: [30, 64, 110] as [number, number, number],
  slate: [45, 55, 72] as [number, number, number],
  coolGray: [90, 105, 125] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  bgSubtle: [241, 245, 249] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gold: [201, 168, 76] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
};

// Layout constants
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const FOOTER_RESERVE = 25; // space reserved at bottom for footer

export function useDamageReportPdf() {
  const { settings } = useTransferInvoiceSettings();
  const [isGenerating, setIsGenerating] = useState(false);

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const getLocationLabel = (loc: string | null | undefined, lang: PdfLang = 'es') => {
    const found = VEHICLE_LOCATIONS.find((l) => l.value === loc);
    if (!found) return loc || '--';
    return lang === 'en' ? (found.label_en || found.label) : found.label;
  };

  // Helper: check if we need a new page, and add one if so
  const ensureSpace = (pdf: jsPDF, yPos: number, needed: number): number => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (yPos + needed > pageHeight - FOOTER_RESERVE) {
      pdf.addPage();
      return 25;
    }
    return yPos;
  };

  // Helper: draw a thin horizontal line
  const drawHLine = (pdf: jsPDF, y: number, color: [number, number, number] = COLORS.border, width = 0.3) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  };

  // Helper: draw a section label with gold underline
  const drawLabel = (pdf: jsPDF, label: string, x: number, y: number) => {
    pdf.setFontSize(7);
    pdf.setFont(PDF_FONT, 'bold');
    pdf.setTextColor(...COLORS.coolGray);
    pdf.text(label, x, y);
    pdf.setDrawColor(...COLORS.gold);
    pdf.setLineWidth(0.4);
    pdf.line(x, y + 1.2, x + pdf.getTextWidth(label), y + 1.2);
  };

  // Helper: draw footer on all pages at the end
  const drawFootersOnAllPages = (pdf: jsPDF, footerText?: string) => {
    const totalPages = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Separator line
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN_LEFT, pageHeight - 18, pageWidth - MARGIN_RIGHT, pageHeight - 18);

      // Footer text
      if (footerText) {
        pdf.setFontSize(6.5);
        pdf.setFont(PDF_FONT, 'italic');
        pdf.setTextColor(...COLORS.lightGray);
        const lines = pdf.splitTextToSize(footerText, contentWidth * 0.75);
        pdf.text(lines, pageWidth / 2, pageHeight - 14, { align: 'center' });
      }

      // Page number
      pdf.setFontSize(7);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text(`${i} / ${totalPages}`, pageWidth - MARGIN_RIGHT, pageHeight - 8, { align: 'right' });
    }
  };

  const generatePdf = async (report: DamageReport, lang: PdfLang = 'es') => {
    const t = PDF_TRANSLATIONS[lang];
    const dateLocale = lang === 'en' ? enUS : es;

    if (!settings) {
      toast.error(t.configError);
      return;
    }
    if (!settings.company_name) {
      toast.error(t.companyError);
      return;
    }

    setIsGenerating(true);

    const numberLocale = lang === 'en' ? 'en-GB' : 'es-ES';
    const formatCurrency = (amount: number | null | undefined) => {
      if (amount == null) return '0,00 €';
      return new Intl.NumberFormat(numberLocale, { style: 'currency', currency: 'EUR' }).format(amount);
    };

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');

      // Register Unicode font
      await registerPdfFonts(pdf);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
      let yPos = 20;

      // ─────────────────────────────────────────────────────────
      // HEADER — Logo left, Company info right
      // ─────────────────────────────────────────────────────────
      const headerStartY = yPos;
      const rightEdge = pageWidth - MARGIN_RIGHT;

      if (settings.logo_url) {
        try {
          const logoBase64 = await loadImageAsBase64(settings.logo_url);
          if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', MARGIN_LEFT, yPos, 36, 18);
          }
        } catch (e) {
          console.error('Error loading logo:', e);
        }
      }

      // Company name
      pdf.setFontSize(13);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(settings.company_name || '', rightEdge, yPos + 5, { align: 'right' });

      // CIF
      let compInfoY = yPos + 10;
      pdf.setFontSize(8);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.slate);
      if (settings.tax_id) {
        pdf.text(`${t.taxIdLabel} ${settings.tax_id}`, rightEdge, compInfoY, { align: 'right' });
        compInfoY += 4;
      }

      // Address, phone, email
      pdf.setFontSize(7.5);
      pdf.setTextColor(...COLORS.coolGray);
      if (settings.address) {
        const addrLines = pdf.splitTextToSize(settings.address, 70);
        addrLines.forEach((line: string) => {
          pdf.text(line, rightEdge, compInfoY, { align: 'right' });
          compInfoY += 3.5;
        });
      }
      if (settings.phone) {
        pdf.text(`${t.phoneLabel} ${settings.phone}`, rightEdge, compInfoY, { align: 'right' });
        compInfoY += 3.5;
      }
      if (settings.email) {
        pdf.text(settings.email, rightEdge, compInfoY, { align: 'right' });
        compInfoY += 3.5;
      }

      yPos = Math.max(headerStartY + 24, compInfoY + 3);

      // Navy separator line
      drawHLine(pdf, yPos, COLORS.navy, 0.6);
      yPos += 10;

      // ─────────────────────────────────────────────────────────
      // DOCUMENT TITLE
      // ─────────────────────────────────────────────────────────
      pdf.setFontSize(20);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(t.title, pageWidth / 2, yPos, { align: 'center' });
      yPos += 8;

      pdf.setFontSize(10);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.navyLight);
      pdf.text(report.report_number, pageWidth / 2, yPos, { align: 'center' });
      yPos += 14;

      // ─────────────────────────────────────────────────────────
      // INFO BOXES — Client/Vehicle left, Report info right
      // ─────────────────────────────────────────────────────────
      const boxGap = 8;
      const boxWidth1 = (contentWidth - boxGap) / 2;
      const boxWidth2 = boxWidth1;
      const boxX2 = MARGIN_LEFT + boxWidth1 + boxGap;

      // Calculate dynamic height based on content
      const hasContract = report.contract_start_date || report.contract_end_date;
      const hasReservation = !!report.external_reservation_number;
      let boxHeight = 46;
      if (hasContract) boxHeight += 10;

      // Box 1: Client & Vehicle
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(MARGIN_LEFT, yPos, boxWidth1, boxHeight, 2, 2, 'FD');

      let b1y = yPos + 8;
      drawLabel(pdf, t.client, MARGIN_LEFT + 7, b1y);
      b1y += 7;
      pdf.setFontSize(10);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.slate);
      pdf.text(report.customer_name || t.noClient, MARGIN_LEFT + 7, b1y);
      b1y += 5;

      if (report.customer_document) {
        pdf.setFontSize(8);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text(`${t.docLabel} ${report.customer_document}`, MARGIN_LEFT + 7, b1y);
        b1y += 6;
      } else {
        b1y += 3;
      }

      drawLabel(pdf, t.vehicle, MARGIN_LEFT + 7, b1y + 2);
      b1y += 9;
      pdf.setFontSize(10);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.slate);
      const vehicleText = report.vehicle
        ? `${report.vehicle.matricula} · ${report.vehicle.modelo || ''}`
        : (report.vehicle_plate || '--');
      pdf.text(vehicleText, MARGIN_LEFT + 7, b1y);

      // Box 2: Report info
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.2);
      pdf.roundedRect(boxX2, yPos, boxWidth2, boxHeight, 2, 2, 'FD');

      let b2y = yPos + 8;
      drawLabel(pdf, t.damageDate, boxX2 + 7, b2y);
      b2y += 7;
      pdf.setFontSize(10);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.slate);
      pdf.text(
        format(new Date(report.damage_date), 'dd MMMM yyyy', { locale: dateLocale }),
        boxX2 + 7, b2y
      );
      b2y += 7;

      drawLabel(pdf, t.reference, boxX2 + 7, b2y);
      b2y += 7;
      pdf.setFontSize(9);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.navyLight);
      pdf.text(report.report_number, boxX2 + 7, b2y);

      if (hasReservation) {
        const refTextW = pdf.getTextWidth(report.report_number);
        pdf.setFontSize(7);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text(t.reservation, boxX2 + 7 + refTextW + 8, b2y - 1);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.navyLight);
        pdf.text(report.external_reservation_number!, boxX2 + 7 + refTextW + 8 + pdf.getTextWidth(t.reservation + ' ') + 1, b2y);
      }

      if (hasContract) {
        b2y += 7;
        drawLabel(pdf, t.contract, boxX2 + 7, b2y);
        b2y += 7;
        pdf.setFontSize(8.5);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        const startD = report.contract_start_date ? format(new Date(report.contract_start_date), 'dd/MM/yyyy') : '--';
        const endD = report.contract_end_date ? format(new Date(report.contract_end_date), 'dd/MM/yyyy') : '--';
        pdf.text(`${startD}  ${t.contractSep}  ${endD}`, boxX2 + 7, b2y);
      }

      yPos += boxHeight + 12;

      // ─────────────────────────────────────────────────────────
      // ITEMS TABLE
      // ─────────────────────────────────────────────────────────
      const items = report.items || [];

      if (items.length > 0) {
        yPos = ensureSpace(pdf, yPos, 40);

        // Column widths calculated to fill contentWidth exactly
        const colW = {
          concept: contentWidth * 0.32,
          location: contentWidth * 0.19,
          severity: contentWidth * 0.13,
          qty: contentWidth * 0.08,
          price: contentWidth * 0.14,
          total: contentWidth * 0.14,
        };

        const tableData = items.map((item) => [
          (lang === 'en' ? (item.catalog_item?.name_en || item.catalog_item?.name_es) : item.catalog_item?.name_es) || item.custom_description || '--',
          getLocationLabel(item.location_on_vehicle, lang),
          t.severityLabels[item.severity_level] || t.severityFallback(item.severity_level),
          String(item.quantity),
          formatCurrency(item.unit_price),
          formatCurrency(item.total_price),
        ]);

        autoTable(pdf, {
          startY: yPos,
          head: [[t.concept, t.location, t.severity, t.qty, t.unitPrice, t.total]],
          body: tableData,
          theme: 'plain',
          tableWidth: contentWidth,
          styles: {
            font: PDF_FONT,
            fontSize: 8.5,
            cellPadding: { top: 4, right: 5, bottom: 4, left: 5 },
            textColor: COLORS.slate,
            lineColor: COLORS.border,
            lineWidth: 0.15,
            overflow: 'linebreak',
            valign: 'middle',
          },
          headStyles: {
            font: PDF_FONT,
            fillColor: COLORS.navy,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: { top: 5, right: 5, bottom: 5, left: 5 },
            halign: 'left',
          },
          alternateRowStyles: {
            fillColor: COLORS.bgSubtle,
          },
          columnStyles: {
            0: { cellWidth: colW.concept, halign: 'left' },
            1: { cellWidth: colW.location, halign: 'left', fontSize: 8 },
            2: { cellWidth: colW.severity, halign: 'center', fontSize: 8 },
            3: { cellWidth: colW.qty, halign: 'center' },
            4: { cellWidth: colW.price, halign: 'right' },
            5: { cellWidth: colW.total, halign: 'right', fontStyle: 'bold', textColor: COLORS.navy },
          },
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        });

        yPos = (pdf as any).lastAutoTable?.finalY || yPos + 40;
      } else {
        pdf.setFontSize(9);
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text(t.noItems, MARGIN_LEFT, yPos + 5);
        yPos += 14;
      }

      yPos += 10;

      // ─────────────────────────────────────────────────────────
      // TOTALS BOX — right-aligned, generous width
      // ─────────────────────────────────────────────────────────
      yPos = ensureSpace(pdf, yPos, 35);

      const hasCollected = report.amount_collected != null;
      const pendiente = (report.total_amount || 0) - (report.amount_collected || 0);
      const hasPendiente = hasCollected && pendiente > 0.01;
      const totalsW = 100;
      const totalsX = pageWidth - MARGIN_RIGHT - totalsW;
      let totalsH = 20;
      if (hasCollected) totalsH += 10;
      if (hasCollected && report.payment_gateway) totalsH += 8;
      if (hasPendiente) totalsH += 9;

      // Background
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.navy);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(totalsX, yPos, totalsW, totalsH, 2, 2, 'FD');

      const tLabelX = totalsX + 10;
      const tValueX = totalsX + totalsW - 10;
      let tY = yPos + 12;

      // Total row
      pdf.setFontSize(11);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(t.totalLabel, tLabelX, tY);
      pdf.setFontSize(13);
      pdf.text(formatCurrency(report.total_amount), tValueX, tY, { align: 'right' });

      if (hasCollected) {
        tY += 10;
        pdf.setDrawColor(...COLORS.border);
        pdf.setLineWidth(0.2);
        pdf.line(tLabelX, tY - 4, tValueX, tY - 4);

        pdf.setFontSize(9);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text(t.collected, tLabelX, tY);
        pdf.setTextColor(...COLORS.green);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.text(formatCurrency(report.amount_collected), tValueX, tY, { align: 'right' });

        // Payment gateway & reference
        if (report.payment_gateway) {
          tY += 8;
          pdf.setFontSize(7.5);
          pdf.setFont(PDF_FONT, 'normal');
          pdf.setTextColor(...COLORS.coolGray);
          const gwLabel = report.payment_gateway === 'stripe' ? 'Stripe' : 'Redsys';
          const refText = report.payment_reference ? ` — ${report.payment_reference}` : '';
          pdf.text(`${gwLabel}${refText}`, tLabelX, tY);
        }

        if (hasPendiente) {
          tY += 9;
          pdf.setFontSize(9);
          pdf.setTextColor(...COLORS.red);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.text(t.pending, tLabelX, tY);
          pdf.text(formatCurrency(pendiente), tValueX, tY, { align: 'right' });
        }
      }

      yPos += totalsH + 10;

      // ─────────────────────────────────────────────────────────
      // NOTES
      // ─────────────────────────────────────────────────────────
      if (report.notes) {
        yPos = ensureSpace(pdf, yPos, 25);
        drawLabel(pdf, t.observations, MARGIN_LEFT, yPos);
        yPos += 6;
        pdf.setFontSize(8.5);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        const notesLines = pdf.splitTextToSize(report.notes, contentWidth);
        pdf.text(notesLines, MARGIN_LEFT, yPos);
        yPos += notesLines.length * 4 + 8;
      }


      // ---------------------------------------------------------------
      // BEFORE / AFTER PHOTOS — report-level vehicle condition photos
      // ---------------------------------------------------------------
      const beforePhotos = report.photos_before || [];
      const afterPhotos = report.photos_after || [];
      const hasBeforeAfter = beforePhotos.length > 0 || afterPhotos.length > 0;

      if (hasBeforeAfter) {
        const baPhotoMaxW = (contentWidth - 8) / 2;
        const baPhotoMaxH = 55;
        const BA_ROW_GAP = 6;
        const BA_PLACEHOLDER_H = 30;

        const renderPhotoGallery = async (title: string, urls: string[]) => {
          if (urls.length === 0) return;

          yPos = ensureSpace(pdf, yPos, 30);

          pdf.setFontSize(10);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.navy);
          pdf.text(title, MARGIN_LEFT, yPos);
          yPos += 3;
          drawHLine(pdf, yPos, COLORS.gold, 0.5);
          yPos += 8;

          const loadedImgs: Array<{ base64: string | null; drawW: number; drawH: number }> = [];
          for (const url of urls) {
            try {
              const imgBase64 = await loadImageAsBase64(url);
              if (imgBase64) {
                const imgProps = pdf.getImageProperties(imgBase64);
                const ratio = imgProps.width / imgProps.height;
                let drawW = baPhotoMaxW;
                let drawH = drawW / ratio;
                if (drawH > baPhotoMaxH) {
                  drawH = baPhotoMaxH;
                  drawW = drawH * ratio;
                }
                loadedImgs.push({ base64: imgBase64, drawW, drawH });
              } else {
                loadedImgs.push({ base64: null, drawW: baPhotoMaxW, drawH: BA_PLACEHOLDER_H });
              }
            } catch {
              loadedImgs.push({ base64: null, drawW: baPhotoMaxW, drawH: BA_PLACEHOLDER_H });
            }
          }

          const rows: Array<Array<{ base64: string | null; drawW: number; drawH: number }>> = [];
          for (let i = 0; i < loadedImgs.length; i += 2) {
            rows.push(loadedImgs.slice(i, i + 2));
          }

          for (const row of rows) {
            const rowH = Math.max(...row.map(img => img.drawH));
            yPos = ensureSpace(pdf, yPos, rowH + BA_ROW_GAP);

            row.forEach((img, colIdx) => {
              const xPos = MARGIN_LEFT + colIdx * (baPhotoMaxW + 8);
              if (img.base64) {
                pdf.setDrawColor(...COLORS.border);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(xPos - 1, yPos - 1, img.drawW + 2, img.drawH + 2, 1, 1, 'S');
                pdf.addImage(img.base64, 'JPEG', xPos, yPos, img.drawW, img.drawH);
              } else {
                pdf.setFillColor(...COLORS.bgSubtle);
                pdf.setDrawColor(...COLORS.border);
                pdf.roundedRect(xPos, yPos, baPhotoMaxW, BA_PLACEHOLDER_H, 1, 1, 'FD');
                pdf.setFontSize(7);
                pdf.setFont(PDF_FONT, 'normal');
                pdf.setTextColor(...COLORS.lightGray);
                pdf.text(t.imageUnavailable, xPos + baPhotoMaxW / 2, yPos + 16, { align: 'center' });
              }
            });

            yPos += rowH + BA_ROW_GAP;
          }

          yPos += 4;
        };

        await renderPhotoGallery(t.photosBefore, beforePhotos);
        await renderPhotoGallery(t.photosAfter, afterPhotos);
      }
      // ─────────────────────────────────────────────────────────
      // PHOTOGRAPHS — aspect-ratio preserved, 2-col grid
      // Proper page-break handling: calculate real row height BEFORE drawing
      // ─────────────────────────────────────────────────────────
      const itemsWithPhotos = items.filter(item => item.photo_urls && item.photo_urls.length > 0);

      if (itemsWithPhotos.length > 0) {
        yPos = ensureSpace(pdf, yPos, 30);

        // Section title
        pdf.setFontSize(11);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.navy);
        pdf.text(t.photos, MARGIN_LEFT, yPos);
        yPos += 3;
        drawHLine(pdf, yPos, COLORS.navy, 0.4);
        yPos += 8;

        const photoMaxW = (contentWidth - 8) / 2; // 2-column grid with gap
        const photoMaxH = 55; // max height per photo
        const PHOTO_ROW_GAP = 6;
        const PHOTO_SUBTITLE_H = 8; // height for damage subtitle
        const PHOTO_PLACEHOLDER_H = 30;

        for (const item of itemsWithPhotos) {
          const itemLabel = (lang === 'en' ? (item.catalog_item?.name_en || item.catalog_item?.name_es) : item.catalog_item?.name_es) || item.custom_description || t.damage;
          const locationLabel = getLocationLabel(item.location_on_vehicle, lang);
          const subtitleText = (locationLabel && locationLabel !== '--') ? `${itemLabel} — ${locationLabel}` : itemLabel;

          const photoUrls = item.photo_urls || [];

          // Pre-load all images for this item to know their dimensions
          const loadedImages: Array<{ base64: string | null; drawW: number; drawH: number }> = [];
          for (const url of photoUrls) {
            try {
              const imgBase64 = await loadImageAsBase64(url);
              if (imgBase64) {
                const imgProps = pdf.getImageProperties(imgBase64);
                const ratio = imgProps.width / imgProps.height;
                let drawW = photoMaxW;
                let drawH = drawW / ratio;
                if (drawH > photoMaxH) {
                  drawH = photoMaxH;
                  drawW = drawH * ratio;
                }
                loadedImages.push({ base64: imgBase64, drawW, drawH });
              } else {
                loadedImages.push({ base64: null, drawW: photoMaxW, drawH: PHOTO_PLACEHOLDER_H });
              }
            } catch {
              loadedImages.push({ base64: null, drawW: photoMaxW, drawH: PHOTO_PLACEHOLDER_H });
            }
          }

          // Group images into rows of 2
          const rows: Array<Array<{ base64: string | null; drawW: number; drawH: number }>> = [];
          for (let i = 0; i < loadedImages.length; i += 2) {
            rows.push(loadedImages.slice(i, i + 2));
          }

          // For the subtitle, ensure space for subtitle + at least first row
          const firstRowH = rows.length > 0 ? Math.max(...rows[0].map(img => img.drawH)) : 0;
          yPos = ensureSpace(pdf, yPos, PHOTO_SUBTITLE_H + firstRowH + PHOTO_ROW_GAP);

          // Draw subtitle
          pdf.setFontSize(8);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.slate);
          pdf.text(subtitleText, MARGIN_LEFT, yPos);
          yPos += 5;

          // Draw each row
          for (const row of rows) {
            const rowH = Math.max(...row.map(img => img.drawH));

            // Ensure space for this entire row before drawing it
            yPos = ensureSpace(pdf, yPos, rowH + PHOTO_ROW_GAP);

            row.forEach((img, colIdx) => {
              const xPos = MARGIN_LEFT + colIdx * (photoMaxW + 8);

              if (img.base64) {
                // Border around photo
                pdf.setDrawColor(...COLORS.border);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(xPos - 1, yPos - 1, img.drawW + 2, img.drawH + 2, 1, 1, 'S');
                pdf.addImage(img.base64, 'JPEG', xPos, yPos, img.drawW, img.drawH);
              } else {
                // Placeholder for failed images
                pdf.setFillColor(...COLORS.bgSubtle);
                pdf.setDrawColor(...COLORS.border);
                pdf.roundedRect(xPos, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
                pdf.setFontSize(7);
                pdf.setFont(PDF_FONT, 'normal');
                pdf.setTextColor(...COLORS.lightGray);
                pdf.text(t.imageUnavailable, xPos + photoMaxW / 2, yPos + 16, { align: 'center' });
              }
            });

            yPos += rowH + PHOTO_ROW_GAP;
          }

          yPos += 4; // gap between damage items
        }
      }

      // ─────────────────────────────────────────────────────────
      // SIGNATURE AREA
      // ─────────────────────────────────────────────────────────
      yPos = ensureSpace(pdf, yPos, 50);
      yPos += 15;

      const sigWidth = (contentWidth - 30) / 2;
      const sig1X = MARGIN_LEFT + 5;
      const sig2X = MARGIN_LEFT + sigWidth + 25;
      const sigLineY = yPos + 22;

      // Client signature
      pdf.setDrawColor(...COLORS.navy);
      pdf.setLineWidth(0.4);
      pdf.line(sig1X, sigLineY, sig1X + sigWidth, sigLineY);
      pdf.setFontSize(8.5);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text(t.clientSignature, sig1X + sigWidth / 2, sigLineY + 5, { align: 'center' });
      if (report.customer_name) {
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLORS.slate);
        pdf.text(report.customer_name, sig1X + sigWidth / 2, sigLineY + 9, { align: 'center' });
      }

      // Company signature
      pdf.setDrawColor(...COLORS.navy);
      pdf.line(sig2X, sigLineY, sig2X + sigWidth, sigLineY);
      pdf.setFontSize(8.5);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text(t.companySignature, sig2X + sigWidth / 2, sigLineY + 5, { align: 'center' });
      if (settings.company_name) {
        pdf.setFontSize(7.5);
        pdf.setTextColor(...COLORS.slate);
        pdf.text(settings.company_name, sig2X + sigWidth / 2, sigLineY + 9, { align: 'center' });
      }

      // ─────────────────────────────────────────────────────────
      // FOOTER on ALL pages
      // ─────────────────────────────────────────────────────────
      drawFootersOnAllPages(pdf, settings.footer_text || undefined);

      // Save
      const fileName = `${report.report_number}.pdf`;
      pdf.save(fileName);
      toast.success(`PDF ${report.report_number} ${t.pdfGenerated}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t.pdfError);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generatePdf,
    isGenerating,
    settingsComplete: !!(settings?.company_name),
  };
}
