import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTransferInvoiceSettings } from './useTransferInvoiceSettings';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { registerPdfFonts, PDF_FONT } from '@/lib/fonts/fontLoader';
import { supabase } from '@/integrations/supabase/client';
import { PHOTO_CATEGORIES, PHOTO_CATEGORY_GROUPS, DAMAGE_ZONES } from '@/types/fleet';
import type {
  FleetVehicleInspection,
  FleetVehicle,
  FleetInspectionPhoto,
  PhotoCategory,
} from '@/types/fleet';

// ─────────────────────────────────────────────────────────
// Corporate Color Palette (matches Azul Cars brand)
// ─────────────────────────────────────────────────────────
const COLORS = {
  navy: [0, 19, 33] as [number, number, number],
  navyLight: [30, 64, 110] as [number, number, number],
  slate: [45, 55, 72] as [number, number, number],
  coolGray: [90, 105, 125] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  bgSubtle: [241, 245, 249] as [number, number, number],
  bgWarm: [245, 243, 239] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  gold: [201, 169, 110] as [number, number, number],
  goldDark: [170, 140, 80] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  orange: [234, 179, 8] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  greenLight: [220, 252, 231] as [number, number, number],
  redLight: [254, 226, 226] as [number, number, number],
  blueAccent: [59, 130, 246] as [number, number, number],
  blueLight: [219, 234, 254] as [number, number, number],
};

// Layout — Landscape A4
const MARGIN_LEFT = 14;
const MARGIN_RIGHT = 14;
const FOOTER_RESERVE = 18;

// Fuel level labels
const FUEL_LABELS: Record<string, string> = {
  '0': 'Vacío',
  '1': '1/8',
  '2': '2/8 (1/4)',
  '3': '3/8',
  '4': '4/8 (1/2)',
  '5': '5/8',
  '6': '6/8 (3/4)',
  '7': '7/8',
  '8': 'Lleno',
};

const SEVERITY_CONFIG: Record<string, { label: string; color: [number, number, number] }> = {
  grave: { label: 'Grave', color: COLORS.red },
  moderado: { label: 'Moderado', color: COLORS.orange },
  leve: { label: 'Leve', color: COLORS.green },
};

export function useComparativeInspectionPdf() {
  const { settings } = useTransferInvoiceSettings();
  const [isGenerating, setIsGenerating] = useState(false);

  // ─── Helpers ────────────────────────────────────────────

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
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

  const getSignedUrl = async (storagePath: string): Promise<string | null> => {
    try {
      const { data } = await supabase.storage
        .from('repair-files')
        .createSignedUrl(storagePath, 3600);
      return data?.signedUrl || null;
    } catch {
      return null;
    }
  };

  const ensureSpace = (pdf: jsPDF, yPos: number, needed: number): number => {
    const pageHeight = pdf.internal.pageSize.getHeight();
    if (yPos + needed > pageHeight - FOOTER_RESERVE) {
      pdf.addPage();
      return 20;
    }
    return yPos;
  };

  const drawHLine = (
    pdf: jsPDF,
    y: number,
    color: [number, number, number] = COLORS.border,
    width = 0.3,
    xStart?: number,
    xEnd?: number,
  ) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(xStart ?? MARGIN_LEFT, y, xEnd ?? (pageWidth - MARGIN_RIGHT), y);
  };

  const drawSectionTitle = (pdf: jsPDF, title: string, y: number): number => {
    pdf.setFontSize(10);
    pdf.setFont(PDF_FONT, 'bold');
    pdf.setTextColor(...COLORS.navy);
    pdf.text(title, MARGIN_LEFT, y);
    y += 1.5;
    const tw = pdf.getTextWidth(title);
    pdf.setDrawColor(...COLORS.gold);
    pdf.setLineWidth(0.6);
    pdf.line(MARGIN_LEFT, y, MARGIN_LEFT + tw + 2, y);
    return y + 5;
  };

  const drawInfoField = (
    pdf: jsPDF,
    label: string,
    value: string,
    x: number,
    y: number,
    maxW = 60,
  ) => {
    pdf.setFontSize(6);
    pdf.setFont(PDF_FONT, 'bold');
    pdf.setTextColor(...COLORS.coolGray);
    pdf.text(label.toUpperCase(), x, y);
    pdf.setFontSize(8.5);
    pdf.setFont(PDF_FONT, 'normal');
    pdf.setTextColor(...COLORS.navy);
    const lines = pdf.splitTextToSize(value || '—', maxW);
    pdf.text(lines, x, y + 4);
    return y + 4 + lines.length * 3.5;
  };

  const drawFootersOnAllPages = (pdf: jsPDF, footerText?: string) => {
    const totalPages = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN_LEFT, pageHeight - 14, pageWidth - MARGIN_RIGHT, pageHeight - 14);

      if (footerText) {
        pdf.setFontSize(5.5);
        pdf.setFont(PDF_FONT, 'italic');
        pdf.setTextColor(...COLORS.lightGray);
        const lines = pdf.splitTextToSize(footerText, contentWidth * 0.75);
        pdf.text(lines, pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      pdf.setFontSize(6.5);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text(`${i} / ${totalPages}`, pageWidth - MARGIN_RIGHT, pageHeight - 6, {
        align: 'right',
      });

      pdf.setFontSize(6.5);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text('AZUL', MARGIN_LEFT, pageHeight - 6);
      pdf.setTextColor(...COLORS.gold);
      pdf.text('.', MARGIN_LEFT + pdf.getTextWidth('AZUL'), pageHeight - 6);
    }
  };

  const getFuelLabel = (nivel: string | null | undefined): string => {
    if (nivel == null) return '—';
    return FUEL_LABELS[String(nivel)] || `${nivel}/8`;
  };

  const drawFuelGauge = (
    pdf: jsPDF,
    nivel: string | null | undefined,
    x: number,
    y: number,
    gaugeW: number,
  ) => {
    const fuelLevel = Number(nivel ?? 0);
    const gaugeH = 4;

    // Background
    pdf.setFillColor(...COLORS.border);
    pdf.roundedRect(x, y, gaugeW, gaugeH, 1.2, 1.2, 'F');
    // Filled portion
    const fillW = (fuelLevel / 8) * gaugeW;
    if (fillW > 0) {
      const fillColor: [number, number, number] =
        fuelLevel <= 2 ? COLORS.red : fuelLevel <= 4 ? COLORS.orange : COLORS.green;
      pdf.setFillColor(...fillColor);
      pdf.roundedRect(x, y, fillW, gaugeH, 1.2, 1.2, 'F');
    }
    // Labels
    pdf.setFontSize(5);
    pdf.setFont(PDF_FONT, 'normal');
    pdf.setTextColor(...COLORS.coolGray);
    pdf.text('E', x - 2.5, y + 3);
    pdf.text('F', x + gaugeW + 1.5, y + 3);

    return y + gaugeH + 2;
  };

  // ─── Main Generate Function ─────────────────────────────

  const generateComparativePdf = async (
    recogida: FleetVehicleInspection,
    devolucion: FleetVehicleInspection,
    vehicle: FleetVehicle | null | undefined,
  ) => {
    if (!settings) {
      toast.error('Configura los datos de facturación primero (Ajustes → Facturación)');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generando informe comparativo...', { duration: 60000 });

    try {
      // Landscape A4
      const pdf = new jsPDF('l', 'mm', 'a4');
      await registerPdfFonts(pdf);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
      const halfW = (contentWidth - 8) / 2;
      const leftColX = MARGIN_LEFT;
      const rightColX = MARGIN_LEFT + halfW + 8;
      let yPos = 14;

      // ═══════════════════════════════════════════════════════
      // HEADER — Navy bar with logo + company info
      // ═══════════════════════════════════════════════════════
      const headerH = 24;
      pdf.setFillColor(...COLORS.navy);
      pdf.rect(0, 0, pageWidth, headerH, 'F');
      pdf.setFillColor(...COLORS.gold);
      pdf.rect(0, headerH, pageWidth, 1, 'F');

      // Logo
      let logoDrawn = false;
      if (settings.logo_url) {
        try {
          const logoBase64 = await loadImageAsBase64(settings.logo_url);
          if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', MARGIN_LEFT, 3.5, 28, 17);
            logoDrawn = true;
          }
        } catch { /* ignore */ }
      }
      if (!logoDrawn) {
        pdf.setFontSize(16);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.white);
        pdf.text('AZUL', MARGIN_LEFT, 15);
        pdf.setTextColor(...COLORS.gold);
        pdf.text('.', MARGIN_LEFT + pdf.getTextWidth('AZUL'), 15);
      }

      // Title centered
      pdf.setFontSize(13);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.white);
      pdf.text('INFORME COMPARATIVO DE INSPECCIÓN', pageWidth / 2, 10, { align: 'center' });

      pdf.setFontSize(8);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(200, 210, 220);
      pdf.text('Recogida vs Devolución', pageWidth / 2, 15, { align: 'center' });

      // Company info right
      const rightEdge = pageWidth - MARGIN_RIGHT;
      pdf.setFontSize(8);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.white);
      pdf.text(settings.company_name || 'Azul Cars', rightEdge, 10, { align: 'right' });
      pdf.setFontSize(6.5);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(200, 210, 220);
      let hY = 14.5;
      if (settings.tax_id) {
        pdf.text(`CIF: ${settings.tax_id}`, rightEdge, hY, { align: 'right' });
        hY += 3;
      }
      if (settings.phone) {
        pdf.text(`Tel: ${settings.phone}`, rightEdge, hY, { align: 'right' });
      }

      yPos = headerH + 1 + 6;

      // ═══════════════════════════════════════════════════════
      // VEHICLE INFO — Compact horizontal card
      // ═══════════════════════════════════════════════════════
      const vCardH = 16;
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(MARGIN_LEFT, yPos, contentWidth, vCardH, 2, 2, 'FD');

      const vY = yPos + 4.5;
      const vCol1 = MARGIN_LEFT + 4;
      const vCol2 = MARGIN_LEFT + contentWidth * 0.18;
      const vCol3 = MARGIN_LEFT + contentWidth * 0.38;
      const vCol4 = MARGIN_LEFT + contentWidth * 0.55;
      const vCol5 = MARGIN_LEFT + contentWidth * 0.72;

      // Matrícula (big)
      pdf.setFontSize(5.5);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text('MATRÍCULA', vCol1, vY);
      pdf.setFontSize(12);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(vehicle?.matricula || '—', vCol1, vY + 5.5);

      drawInfoField(pdf, 'Marca / Modelo', `${vehicle?.marca || ''} ${vehicle?.modelo || ''}`.trim() || '—', vCol2, vY, 50);
      drawInfoField(pdf, 'Color', vehicle?.color || '—', vCol3, vY, 30);
      drawInfoField(pdf, 'Proveedor', vehicle?.proveedor || '—', vCol4, vY, 40);
      drawInfoField(pdf, 'Nº Contrato', vehicle?.numero_contrato || '—', vCol5, vY, 40);

      // Generation date
      pdf.setFontSize(6);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text(
        `Generado: ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        rightEdge - 4,
        vY + 5.5,
        { align: 'right' },
      );

      yPos += vCardH + 6;

      // ═══════════════════════════════════════════════════════
      // SIDE-BY-SIDE COLUMN HEADERS
      // ═══════════════════════════════════════════════════════
      // Left: RECOGIDA header
      const colHeaderH = 7;
      pdf.setFillColor(...COLORS.blueAccent);
      pdf.roundedRect(leftColX, yPos, halfW, colHeaderH, 1.5, 1.5, 'F');
      pdf.setFontSize(9);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.white);
      pdf.text('RECOGIDA', leftColX + halfW / 2, yPos + 5, { align: 'center' });

      // Right: DEVOLUCIÓN header
      pdf.setFillColor(...COLORS.gold);
      pdf.roundedRect(rightColX, yPos, halfW, colHeaderH, 1.5, 1.5, 'F');
      pdf.setFontSize(9);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text('DEVOLUCIÓN', rightColX + halfW / 2, yPos + 5, { align: 'center' });

      yPos += colHeaderH + 4;

      // ═══════════════════════════════════════════════════════
      // INSPECTION DATA COMPARISON TABLE
      // ═══════════════════════════════════════════════════════
      const recDate = recogida.inspection_date
        ? format(new Date(recogida.inspection_date), "d MMM yyyy — HH:mm", { locale: es })
        : '—';
      const devDate = devolucion.inspection_date
        ? format(new Date(devolucion.inspection_date), "d MMM yyyy — HH:mm", { locale: es })
        : '—';

      const recKm = recogida.km != null ? `${recogida.km.toLocaleString('es-ES')} km` : '—';
      const devKm = devolucion.km != null ? `${devolucion.km.toLocaleString('es-ES')} km` : '—';

      const recFuel = getFuelLabel(recogida.nivel_combustible);
      const devFuel = getFuelLabel(devolucion.nivel_combustible);

      const recInspector = recogida.inspector_profile?.name || '—';
      const devInspector = devolucion.inspector_profile?.name || '—';

      const recDamages = recogida.damages?.length || 0;
      const devDamages = devolucion.damages?.length || 0;

      const recPhotos = recogida.photos?.length || 0;
      const devPhotos = devolucion.photos?.length || 0;

      autoTable(pdf, {
        startY: yPos,
        head: [['Concepto', 'Recogida', 'Devolución', 'Diferencia']],
        body: [
          [
            'Fecha',
            recDate,
            devDate,
            (() => {
              if (recogida.inspection_date && devolucion.inspection_date) {
                const diffMs = new Date(devolucion.inspection_date).getTime() - new Date(recogida.inspection_date).getTime();
                const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                return `${diffDays} días`;
              }
              return '—';
            })(),
          ],
          [
            'Kilómetros',
            recKm,
            devKm,
            (() => {
              if (recogida.km != null && devolucion.km != null) {
                const diff = devolucion.km - recogida.km;
                return `${diff >= 0 ? '+' : ''}${diff.toLocaleString('es-ES')} km`;
              }
              return '—';
            })(),
          ],
          [
            'Combustible',
            recFuel,
            devFuel,
            (() => {
              if (recogida.nivel_combustible != null && devolucion.nivel_combustible != null) {
                const diff = Number(devolucion.nivel_combustible) - Number(recogida.nivel_combustible);
                if (diff === 0) return 'Sin cambio';
                return `${diff > 0 ? '+' : ''}${diff}/8`;
              }
              return '—';
            })(),
          ],
          ['Inspector', recInspector, devInspector, ''],
          ['Fotos', String(recPhotos), String(devPhotos), ''],
          ['Daños', String(recDamages), String(devDamages), (() => {
            const diff = devDamages - recDamages;
            if (diff === 0) return 'Sin cambio';
            return `${diff > 0 ? '+' : ''}${diff} daños`;
          })()],
        ],
        margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
        styles: {
          font: PDF_FONT,
          fontSize: 8,
          cellPadding: 2.5,
          textColor: COLORS.slate,
          lineColor: COLORS.border,
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        alternateRowStyles: {
          fillColor: COLORS.bgLight,
        },
        columnStyles: {
          0: { cellWidth: 35, fontStyle: 'bold', textColor: COLORS.navy },
          1: { cellWidth: (contentWidth - 35 - 40) / 2 },
          2: { cellWidth: (contentWidth - 35 - 40) / 2 },
          3: { cellWidth: 40, fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          // Highlight difference column
          if (data.section === 'body' && data.column.index === 3) {
            const text = String(data.cell.raw || '');
            if (text.startsWith('+') && !text.includes('Sin cambio')) {
              data.cell.styles.textColor = COLORS.red;
            } else if (text.startsWith('-')) {
              data.cell.styles.textColor = COLORS.green;
            }
          }
        },
      });

      yPos = (pdf as any).lastAutoTable.finalY + 4;

      // ═══════════════════════════════════════════════════════
      // FUEL GAUGES SIDE BY SIDE
      // ═══════════════════════════════════════════════════════
      if (recogida.nivel_combustible != null || devolucion.nivel_combustible != null) {
        yPos = ensureSpace(pdf, yPos, 14);

        const gaugeW = halfW * 0.6;

        // Left gauge
        pdf.setFontSize(6);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text('COMBUSTIBLE RECOGIDA', leftColX, yPos);
        drawFuelGauge(pdf, recogida.nivel_combustible, leftColX + 4, yPos + 3, gaugeW);
        pdf.setFontSize(7);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        pdf.text(recFuel, leftColX + gaugeW + 10, yPos + 6);

        // Right gauge
        pdf.setFontSize(6);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text('COMBUSTIBLE DEVOLUCIÓN', rightColX, yPos);
        drawFuelGauge(pdf, devolucion.nivel_combustible, rightColX + 4, yPos + 3, gaugeW);
        pdf.setFontSize(7);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        pdf.text(devFuel, rightColX + gaugeW + 10, yPos + 6);

        yPos += 14;
      }

      // ═══════════════════════════════════════════════════════
      // NOTES SIDE BY SIDE
      // ═══════════════════════════════════════════════════════
      if (recogida.notas || devolucion.notas) {
        yPos = ensureSpace(pdf, yPos, 25);
        yPos = drawSectionTitle(pdf, 'OBSERVACIONES', yPos);

        const notesColW = halfW - 4;

        // Left notes
        pdf.setFontSize(6.5);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.blueAccent);
        pdf.text('Recogida:', leftColX, yPos);

        pdf.setFontSize(7.5);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        const recNotes = pdf.splitTextToSize(recogida.notas || 'Sin observaciones', notesColW);
        pdf.text(recNotes, leftColX, yPos + 4);

        // Right notes
        pdf.setFontSize(6.5);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.goldDark);
        pdf.text('Devolución:', rightColX, yPos);

        pdf.setFontSize(7.5);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        const devNotes = pdf.splitTextToSize(devolucion.notas || 'Sin observaciones', notesColW);
        pdf.text(devNotes, rightColX, yPos + 4);

        const maxNotesH = Math.max(recNotes.length, devNotes.length) * 3.5 + 6;
        yPos += maxNotesH + 4;
      }

      // ═══════════════════════════════════════════════════════
      // DAMAGES COMPARISON
      // ═══════════════════════════════════════════════════════
      const recDmgList = recogida.damages || [];
      const devDmgList = devolucion.damages || [];

      if (recDmgList.length > 0 || devDmgList.length > 0) {
        yPos = ensureSpace(pdf, yPos, 30);
        yPos = drawSectionTitle(pdf, 'DAÑOS REGISTRADOS', yPos);

        const getZoneLabel = (zona: string) =>
          DAMAGE_ZONES.find(z => z.key === zona)?.label || zona;

        // Combined damages table
        const maxRows = Math.max(recDmgList.length, devDmgList.length);
        const tableBody: string[][] = [];

        for (let i = 0; i < maxRows; i++) {
          const rDmg = recDmgList[i];
          const dDmg = devDmgList[i];
          tableBody.push([
            rDmg ? getZoneLabel(rDmg.zona) : '',
            rDmg ? (rDmg.pieza || '—') : '',
            rDmg ? (SEVERITY_CONFIG[rDmg.severidad]?.label || rDmg.severidad) : '',
            dDmg ? getZoneLabel(dDmg.zona) : '',
            dDmg ? (dDmg.pieza || '—') : '',
            dDmg ? (SEVERITY_CONFIG[dDmg.severidad]?.label || dDmg.severidad) : '',
          ]);
        }

        autoTable(pdf, {
          startY: yPos,
          head: [['Zona (R)', 'Pieza (R)', 'Sev. (R)', 'Zona (D)', 'Pieza (D)', 'Sev. (D)']],
          body: tableBody,
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: {
            font: PDF_FONT,
            fontSize: 7,
            cellPadding: 2,
            textColor: COLORS.slate,
            lineColor: COLORS.border,
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: COLORS.navy,
            textColor: COLORS.white,
            fontStyle: 'bold',
            fontSize: 6.5,
          },
          alternateRowStyles: {
            fillColor: COLORS.bgLight,
          },
          columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20 },
            3: { cellWidth: 'auto' },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 20 },
          },
          didParseCell: (data) => {
            // Severity color coding
            if (data.section === 'body' && (data.column.index === 2 || data.column.index === 5)) {
              const text = String(data.cell.raw || '');
              if (text === 'Grave') {
                data.cell.styles.textColor = COLORS.red;
                data.cell.styles.fontStyle = 'bold';
              } else if (text === 'Moderado') {
                data.cell.styles.textColor = COLORS.orange;
                data.cell.styles.fontStyle = 'bold';
              } else if (text === 'Leve') {
                data.cell.styles.textColor = COLORS.green;
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Blue tint for recogida columns
            if (data.section === 'head' && data.column.index <= 2) {
              data.cell.styles.fillColor = COLORS.blueAccent;
            }
            // Gold tint for devolución columns
            if (data.section === 'head' && data.column.index >= 3) {
              data.cell.styles.fillColor = COLORS.goldDark;
            }
          },
        });

        yPos = (pdf as any).lastAutoTable.finalY + 6;

        // New damages summary
        if (devDmgList.length > recDmgList.length) {
          const newDamages = devDmgList.length - recDmgList.length;
          yPos = ensureSpace(pdf, yPos, 10);
          pdf.setFillColor(...COLORS.redLight);
          pdf.roundedRect(MARGIN_LEFT, yPos - 2, contentWidth, 8, 1.5, 1.5, 'F');
          pdf.setFontSize(7.5);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.red);
          pdf.text(
            `⚠ Se detectaron ${newDamages} daño${newDamages > 1 ? 's' : ''} nuevo${newDamages > 1 ? 's' : ''} en la devolución respecto a la recogida`,
            pageWidth / 2,
            yPos + 3,
            { align: 'center' },
          );
          yPos += 12;
        } else if (devDmgList.length === 0 && recDmgList.length === 0) {
          yPos = ensureSpace(pdf, yPos, 10);
          pdf.setFillColor(...COLORS.greenLight);
          pdf.roundedRect(MARGIN_LEFT, yPos - 2, contentWidth, 8, 1.5, 1.5, 'F');
          pdf.setFontSize(7.5);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.green);
          pdf.text(
            'Sin daños registrados en ninguna de las inspecciones',
            pageWidth / 2,
            yPos + 3,
            { align: 'center' },
          );
          yPos += 12;
        }
      }

      // ═══════════════════════════════════════════════════════
      // PHOTOGRAPHS — Side by side per category
      // ═══════════════════════════════════════════════════════
      const recPhotosArr = recogida.photos || [];
      const devPhotosArr = devolucion.photos || [];

      if (recPhotosArr.length > 0 || devPhotosArr.length > 0) {
        pdf.addPage();
        yPos = 20;

        // Section title
        yPos = drawSectionTitle(
          pdf,
          `COMPARATIVA FOTOGRÁFICA (${recPhotosArr.length} recogida / ${devPhotosArr.length} devolución)`,
          yPos,
        );

        // Column headers
        const photoColHeaderH = 6;
        pdf.setFillColor(...COLORS.blueAccent);
        pdf.roundedRect(leftColX, yPos, halfW, photoColHeaderH, 1.2, 1.2, 'F');
        pdf.setFontSize(8);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.white);
        pdf.text('RECOGIDA', leftColX + halfW / 2, yPos + 4.2, { align: 'center' });

        pdf.setFillColor(...COLORS.gold);
        pdf.roundedRect(rightColX, yPos, halfW, photoColHeaderH, 1.2, 1.2, 'F');
        pdf.setFontSize(8);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.navy);
        pdf.text('DEVOLUCIÓN', rightColX + halfW / 2, yPos + 4.2, { align: 'center' });

        yPos += photoColHeaderH + 4;

        // Ordered categories
        const orderedCategories: PhotoCategory[] = [
          ...PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key)),
        ];
        const allCatKeys = Array.from(new Set([
          ...recPhotosArr.map(p => p.photo_category),
          ...devPhotosArr.map(p => p.photo_category),
        ]));
        for (const k of allCatKeys) {
          if (!orderedCategories.includes(k)) orderedCategories.push(k);
        }

        const photoMaxW = halfW - 4;
        const photoMaxH = 50;
        const PHOTO_PLACEHOLDER_H = 25;

        // Pre-load all photos
        toast.dismiss(toastId);
        const loadToastId = toast.loading('Cargando fotografías...', { duration: 120000 });

        const photoCache = new Map<string, string | null>();

        const allPhotos = [...recPhotosArr, ...devPhotosArr];
        const uniquePaths = Array.from(new Set(allPhotos.map(p => p.storage_path)));

        // Load in batches
        const BATCH_SIZE = 6;
        for (let i = 0; i < uniquePaths.length; i += BATCH_SIZE) {
          const batch = uniquePaths.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (path) => {
              const signedUrl = await getSignedUrl(path);
              if (signedUrl) {
                const base64 = await loadImageAsBase64(signedUrl);
                photoCache.set(path, base64);
              } else {
                photoCache.set(path, null);
              }
            }),
          );
        }

        toast.dismiss(loadToastId);
        const renderToastId = toast.loading('Renderizando PDF...', { duration: 60000 });

        for (const catKey of orderedCategories) {
          const catRecPhotos = recPhotosArr.filter(p => p.photo_category === catKey);
          const catDevPhotos = devPhotosArr.filter(p => p.photo_category === catKey);

          if (catRecPhotos.length === 0 && catDevPhotos.length === 0) continue;

          const catLabel = PHOTO_CATEGORIES.find(c => c.key === catKey)?.label || catKey;

          // Category subtitle
          yPos = ensureSpace(pdf, yPos, 35);

          pdf.setFontSize(7.5);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.navy);
          pdf.text(catLabel.toUpperCase(), MARGIN_LEFT, yPos);
          pdf.setDrawColor(...COLORS.gold);
          pdf.setLineWidth(0.4);
          pdf.line(MARGIN_LEFT, yPos + 1.2, MARGIN_LEFT + pdf.getTextWidth(catLabel.toUpperCase()) + 2, yPos + 1.2);
          yPos += 5;

          // Pair photos: show max of both sides
          const maxCount = Math.max(catRecPhotos.length, catDevPhotos.length);

          for (let i = 0; i < maxCount; i++) {
            const recPhoto = catRecPhotos[i] || null;
            const devPhoto = catDevPhotos[i] || null;

            // Calculate row height
            let leftH = PHOTO_PLACEHOLDER_H;
            let rightH = PHOTO_PLACEHOLDER_H;
            let leftBase64: string | null = null;
            let rightBase64: string | null = null;
            let leftDrawW = photoMaxW;
            let leftDrawH = PHOTO_PLACEHOLDER_H;
            let rightDrawW = photoMaxW;
            let rightDrawH = PHOTO_PLACEHOLDER_H;

            if (recPhoto) {
              leftBase64 = photoCache.get(recPhoto.storage_path) || null;
              if (leftBase64) {
                try {
                  const imgProps = pdf.getImageProperties(leftBase64);
                  const ratio = imgProps.width / imgProps.height;
                  leftDrawW = photoMaxW;
                  leftDrawH = leftDrawW / ratio;
                  if (leftDrawH > photoMaxH) {
                    leftDrawH = photoMaxH;
                    leftDrawW = leftDrawH * ratio;
                  }
                  leftH = leftDrawH;
                } catch {
                  leftBase64 = null;
                }
              }
            }

            if (devPhoto) {
              rightBase64 = photoCache.get(devPhoto.storage_path) || null;
              if (rightBase64) {
                try {
                  const imgProps = pdf.getImageProperties(rightBase64);
                  const ratio = imgProps.width / imgProps.height;
                  rightDrawW = photoMaxW;
                  rightDrawH = rightDrawW / ratio;
                  if (rightDrawH > photoMaxH) {
                    rightDrawH = photoMaxH;
                    rightDrawW = rightDrawH * ratio;
                  }
                  rightH = rightDrawH;
                } catch {
                  rightBase64 = null;
                }
              }
            }

            const rowH = Math.max(leftH, rightH);
            yPos = ensureSpace(pdf, yPos, rowH + 6);

            // Draw left photo (recogida)
            if (recPhoto) {
              if (leftBase64) {
                pdf.setDrawColor(...COLORS.blueAccent);
                pdf.setLineWidth(0.4);
                pdf.roundedRect(leftColX - 0.5, yPos - 0.5, leftDrawW + 1, leftDrawH + 1, 1, 1, 'S');
                pdf.addImage(leftBase64, 'JPEG', leftColX, yPos, leftDrawW, leftDrawH);
              } else {
                pdf.setFillColor(...COLORS.bgSubtle);
                pdf.setDrawColor(...COLORS.border);
                pdf.roundedRect(leftColX, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
                pdf.setFontSize(6.5);
                pdf.setFont(PDF_FONT, 'normal');
                pdf.setTextColor(...COLORS.lightGray);
                pdf.text('Imagen no disponible', leftColX + photoMaxW / 2, yPos + PHOTO_PLACEHOLDER_H / 2, { align: 'center' });
              }
            } else {
              // No photo for this category in recogida
              pdf.setFillColor(...COLORS.bgSubtle);
              pdf.setDrawColor(...COLORS.border);
              pdf.setLineWidth(0.2);
              pdf.roundedRect(leftColX, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
              pdf.setFontSize(6.5);
              pdf.setFont(PDF_FONT, 'italic');
              pdf.setTextColor(...COLORS.lightGray);
              pdf.text('Sin foto', leftColX + photoMaxW / 2, yPos + PHOTO_PLACEHOLDER_H / 2, { align: 'center' });
            }

            // Draw right photo (devolución)
            if (devPhoto) {
              if (rightBase64) {
                pdf.setDrawColor(...COLORS.gold);
                pdf.setLineWidth(0.4);
                pdf.roundedRect(rightColX - 0.5, yPos - 0.5, rightDrawW + 1, rightDrawH + 1, 1, 1, 'S');
                pdf.addImage(rightBase64, 'JPEG', rightColX, yPos, rightDrawW, rightDrawH);
              } else {
                pdf.setFillColor(...COLORS.bgSubtle);
                pdf.setDrawColor(...COLORS.border);
                pdf.roundedRect(rightColX, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
                pdf.setFontSize(6.5);
                pdf.setFont(PDF_FONT, 'normal');
                pdf.setTextColor(...COLORS.lightGray);
                pdf.text('Imagen no disponible', rightColX + photoMaxW / 2, yPos + PHOTO_PLACEHOLDER_H / 2, { align: 'center' });
              }
            } else {
              pdf.setFillColor(...COLORS.bgSubtle);
              pdf.setDrawColor(...COLORS.border);
              pdf.setLineWidth(0.2);
              pdf.roundedRect(rightColX, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
              pdf.setFontSize(6.5);
              pdf.setFont(PDF_FONT, 'italic');
              pdf.setTextColor(...COLORS.lightGray);
              pdf.text('Sin foto', rightColX + photoMaxW / 2, yPos + PHOTO_PLACEHOLDER_H / 2, { align: 'center' });
            }

            // Vertical divider between columns
            const dividerX = MARGIN_LEFT + halfW + 4;
            pdf.setDrawColor(...COLORS.border);
            pdf.setLineWidth(0.2);
            pdf.line(dividerX, yPos, dividerX, yPos + rowH);

            yPos += rowH + 4;
          }

          yPos += 3;
        }

        toast.dismiss(renderToastId);
      }

      // ═══════════════════════════════════════════════════════
      // SUMMARY SECTION
      // ═══════════════════════════════════════════════════════
      yPos = ensureSpace(pdf, yPos, 25);
      yPos += 3;
      drawHLine(pdf, yPos, COLORS.navy, 0.4);
      yPos += 5;

      pdf.setFontSize(7);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.coolGray);

      const summaryParts: string[] = [];
      if (recogida.km != null && devolucion.km != null) {
        summaryParts.push(`Km recorridos: ${(devolucion.km - recogida.km).toLocaleString('es-ES')} km`);
      }
      if (recogida.inspection_date && devolucion.inspection_date) {
        const diffMs = new Date(devolucion.inspection_date).getTime() - new Date(recogida.inspection_date).getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        summaryParts.push(`Duración: ${diffDays} días`);
      }
      summaryParts.push(`Fotos: ${recPhotosArr.length} (R) / ${devPhotosArr.length} (D)`);
      summaryParts.push(`Daños: ${recDmgList.length} (R) / ${devDmgList.length} (D)`);

      pdf.text(summaryParts.join('   |   '), MARGIN_LEFT, yPos);

      // ═══════════════════════════════════════════════════════
      // FOOTER on ALL pages
      // ═══════════════════════════════════════════════════════
      drawFootersOnAllPages(pdf, settings.footer_text || undefined);

      // Save
      const plate = vehicle?.matricula || 'vehiculo';
      const dateStr = format(new Date(), 'yyyyMMdd');
      const fileName = `Comparativa_${plate}_${dateStr}.pdf`;
      pdf.save(fileName);

      toast.success('Informe comparativo generado correctamente');
    } catch (error) {
      console.error('Error generating comparative PDF:', error);
      toast.error('Error al generar el informe comparativo');
    } finally {
      toast.dismiss(toastId);
      setIsGenerating(false);
    }
  };

  return {
    generateComparativePdf,
    isGenerating,
    settingsComplete: !!(settings?.company_name),
  };
}
