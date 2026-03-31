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
  FleetInspectionDamage,
  PhotoCategory,
} from '@/types/fleet';

// ─────────────────────────────────────────────────────────
// Corporate Color Palette (matches Azul Cars brand)
// ─────────────────────────────────────────────────────────
const COLORS = {
  navy: [0, 19, 33] as [number, number, number],       // #001321
  navyLight: [30, 64, 110] as [number, number, number],
  slate: [45, 55, 72] as [number, number, number],
  coolGray: [90, 105, 125] as [number, number, number],
  lightGray: [148, 163, 184] as [number, number, number],
  bgLight: [248, 250, 252] as [number, number, number],
  bgSubtle: [241, 245, 249] as [number, number, number],
  bgWarm: [245, 243, 239] as [number, number, number],  // #F5F3EF
  white: [255, 255, 255] as [number, number, number],
  gold: [201, 169, 110] as [number, number, number],    // #C9A96E
  goldDark: [170, 140, 80] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  orange: [234, 179, 8] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
};

// Layout
const MARGIN_LEFT = 18;
const MARGIN_RIGHT = 18;
const FOOTER_RESERVE = 22;

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

export function useInspectionPdf() {
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
      return 25;
    }
    return yPos;
  };

  const drawHLine = (
    pdf: jsPDF,
    y: number,
    color: [number, number, number] = COLORS.border,
    width = 0.3,
  ) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setDrawColor(...color);
    pdf.setLineWidth(width);
    pdf.line(MARGIN_LEFT, y, pageWidth - MARGIN_RIGHT, y);
  };

  const drawSectionTitle = (pdf: jsPDF, title: string, y: number): number => {
    pdf.setFontSize(10);
    pdf.setFont(PDF_FONT, 'bold');
    pdf.setTextColor(...COLORS.navy);
    pdf.text(title, MARGIN_LEFT, y);
    y += 1.5;
    // Gold underline
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
    pdf.setFontSize(6.5);
    pdf.setFont(PDF_FONT, 'bold');
    pdf.setTextColor(...COLORS.coolGray);
    pdf.text(label.toUpperCase(), x, y);
    pdf.setFontSize(9);
    pdf.setFont(PDF_FONT, 'normal');
    pdf.setTextColor(...COLORS.navy);
    const lines = pdf.splitTextToSize(value || '—', maxW);
    pdf.text(lines, x, y + 4.5);
    return y + 4.5 + lines.length * 4;
  };

  const drawFootersOnAllPages = (pdf: jsPDF, footerText?: string) => {
    const totalPages = pdf.getNumberOfPages();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;

    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // Separator
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN_LEFT, pageHeight - 16, pageWidth - MARGIN_RIGHT, pageHeight - 16);

      // Footer text
      if (footerText) {
        pdf.setFontSize(6);
        pdf.setFont(PDF_FONT, 'italic');
        pdf.setTextColor(...COLORS.lightGray);
        const lines = pdf.splitTextToSize(footerText, contentWidth * 0.75);
        pdf.text(lines, pageWidth / 2, pageHeight - 12, { align: 'center' });
      }

      // Page number
      pdf.setFontSize(7);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text(`${i} / ${totalPages}`, pageWidth - MARGIN_RIGHT, pageHeight - 7, {
        align: 'right',
      });

      // Brand mark
      pdf.setFontSize(7);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text('AZUL', MARGIN_LEFT, pageHeight - 7);
      pdf.setTextColor(...COLORS.gold);
      pdf.text('.', MARGIN_LEFT + pdf.getTextWidth('AZUL'), pageHeight - 7);
    }
  };

  // ─── Main Generate Function ─────────────────────────────

  const generatePdf = async (
    inspection: FleetVehicleInspection,
    vehicle: FleetVehicle | null | undefined,
  ) => {
    if (!settings) {
      toast.error('Configura los datos de facturación primero (Ajustes → Facturación)');
      return;
    }

    setIsGenerating(true);

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      await registerPdfFonts(pdf);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
      let yPos = 16;

      // ═══════════════════════════════════════════════════════
      // HEADER — Navy bar with logo + company info
      // ═══════════════════════════════════════════════════════
      const headerH = 28;
      pdf.setFillColor(...COLORS.navy);
      pdf.rect(0, 0, pageWidth, headerH, 'F');

      // Gold accent line at bottom of header
      pdf.setFillColor(...COLORS.gold);
      pdf.rect(0, headerH, pageWidth, 1.2, 'F');

      // Logo or brand text
      let logoDrawn = false;
      if (settings.logo_url) {
        try {
          const logoBase64 = await loadImageAsBase64(settings.logo_url);
          if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', MARGIN_LEFT, 5, 32, 18);
            logoDrawn = true;
          }
        } catch {
          /* ignore */
        }
      }
      if (!logoDrawn) {
        pdf.setFontSize(18);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.white);
        pdf.text('AZUL', MARGIN_LEFT, 18);
        pdf.setTextColor(...COLORS.gold);
        pdf.text('.', MARGIN_LEFT + pdf.getTextWidth('AZUL'), 18);
      }

      // Company info right-aligned in header
      const rightEdge = pageWidth - MARGIN_RIGHT;
      pdf.setFontSize(10);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.white);
      pdf.text(settings.company_name || 'Azul Cars', rightEdge, 11, { align: 'right' });

      pdf.setFontSize(7);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(200, 210, 220);
      let hInfoY = 16;
      if (settings.tax_id) {
        pdf.text(`CIF: ${settings.tax_id}`, rightEdge, hInfoY, { align: 'right' });
        hInfoY += 3.5;
      }
      if (settings.phone) {
        pdf.text(`Tel: ${settings.phone}`, rightEdge, hInfoY, { align: 'right' });
        hInfoY += 3.5;
      }
      if (settings.email) {
        pdf.text(settings.email, rightEdge, hInfoY, { align: 'right' });
      }

      yPos = headerH + 1.2 + 8;

      // ═══════════════════════════════════════════════════════
      // DOCUMENT TITLE
      // ═══════════════════════════════════════════════════════
      const inspType = inspection.inspection_type === 'recogida' ? 'RECOGIDA' : 'DEVOLUCIÓN';
      pdf.setFontSize(16);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(`INSPECCIÓN DE ${inspType}`, MARGIN_LEFT, yPos);
      yPos += 5;

      // Reference and date
      pdf.setFontSize(8);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.coolGray);
      const inspDate = inspection.inspection_date
        ? format(new Date(inspection.inspection_date), "d 'de' MMMM 'de' yyyy — HH:mm", { locale: es })
        : '—';
      pdf.text(`Fecha: ${inspDate}`, MARGIN_LEFT, yPos);
      yPos += 3.5;
      pdf.text(
        `Generado: ${format(new Date(), "d MMM yyyy, HH:mm", { locale: es })}`,
        MARGIN_LEFT,
        yPos,
      );
      yPos += 7;

      drawHLine(pdf, yPos, COLORS.navy, 0.4);
      yPos += 8;

      // ═══════════════════════════════════════════════════════
      // VEHICLE INFO CARD
      // ═══════════════════════════════════════════════════════
      yPos = drawSectionTitle(pdf, 'DATOS DEL VEHÍCULO', yPos);

      // Card background
      const cardH = 28;
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(MARGIN_LEFT, yPos, contentWidth, cardH, 2, 2, 'FD');

      const col1 = MARGIN_LEFT + 5;
      const col2 = MARGIN_LEFT + contentWidth * 0.28;
      const col3 = MARGIN_LEFT + contentWidth * 0.55;
      const col4 = MARGIN_LEFT + contentWidth * 0.78;
      const cardY = yPos + 5;

      // Matrícula (highlighted)
      pdf.setFontSize(6.5);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text('MATRÍCULA', col1, cardY);
      pdf.setFontSize(13);
      pdf.setFont(PDF_FONT, 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(vehicle?.matricula || '—', col1, cardY + 6);

      // Marca / Modelo
      drawInfoField(pdf, 'Marca / Modelo', `${vehicle?.marca || ''} ${vehicle?.modelo || ''}`.trim() || '—', col2, cardY, 45);

      // Color
      drawInfoField(pdf, 'Color', vehicle?.color || '—', col3, cardY, 35);

      // Categoría
      drawInfoField(pdf, 'Categoría', vehicle?.categoria || '—', col4, cardY, 35);

      yPos += cardH + 4;

      // Second row: contract info
      if (vehicle?.proveedor || vehicle?.numero_contrato) {
        const card2H = 18;
        pdf.setFillColor(...COLORS.bgLight);
        pdf.setDrawColor(...COLORS.border);
        pdf.roundedRect(MARGIN_LEFT, yPos, contentWidth, card2H, 2, 2, 'FD');

        const c2Y = yPos + 5;
        drawInfoField(pdf, 'Proveedor', vehicle?.proveedor || '—', col1, c2Y, 40);
        drawInfoField(pdf, 'Nº Contrato', vehicle?.numero_contrato || '—', col2, c2Y, 40);

        if (vehicle?.fecha_inicio_contrato || vehicle?.fecha_fin_contrato) {
          const start = vehicle.fecha_inicio_contrato
            ? format(new Date(vehicle.fecha_inicio_contrato), 'dd/MM/yyyy')
            : '—';
          const end = vehicle.fecha_fin_contrato
            ? format(new Date(vehicle.fecha_fin_contrato), 'dd/MM/yyyy')
            : '—';
          drawInfoField(pdf, 'Periodo contrato', `${start} — ${end}`, col3, c2Y, 55);
        }

        yPos += card2H + 4;
      }

      yPos += 4;

      // ═══════════════════════════════════════════════════════
      // INSPECTION DATA
      // ═══════════════════════════════════════════════════════
      yPos = drawSectionTitle(pdf, 'DATOS DE LA INSPECCIÓN', yPos);

      const inspCardH = 18;
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.roundedRect(MARGIN_LEFT, yPos, contentWidth, inspCardH, 2, 2, 'FD');

      const iY = yPos + 5;
      drawInfoField(pdf, 'Tipo', inspection.inspection_type === 'recogida' ? 'Recogida' : 'Devolución', col1, iY, 30);
      drawInfoField(pdf, 'Kilómetros', inspection.km != null ? `${inspection.km.toLocaleString('es-ES')} km` : '—', col2, iY, 30);

      const fuelLabel = inspection.nivel_combustible != null
        ? (FUEL_LABELS[String(inspection.nivel_combustible)] || `${inspection.nivel_combustible}/8`)
        : '—';
      drawInfoField(pdf, 'Combustible', fuelLabel, col3, iY, 30);

      const inspectorName = inspection.inspector_profile?.name || '—';
      drawInfoField(pdf, 'Inspector', inspectorName, col4, iY, 35);

      yPos += inspCardH + 4;

      // Fuel gauge visual
      if (inspection.nivel_combustible != null) {
        const fuelLevel = Number(inspection.nivel_combustible);
        const gaugeW = 60;
        const gaugeH = 5;
        const gaugeX = MARGIN_LEFT;
        const gaugeY = yPos;

        pdf.setFontSize(6.5);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text('NIVEL COMBUSTIBLE', gaugeX, gaugeY);

        const barY = gaugeY + 2.5;
        // Background
        pdf.setFillColor(...COLORS.border);
        pdf.roundedRect(gaugeX, barY, gaugeW, gaugeH, 1.5, 1.5, 'F');
        // Filled portion
        const fillW = (fuelLevel / 8) * gaugeW;
        if (fillW > 0) {
          const fillColor: [number, number, number] =
            fuelLevel <= 2 ? COLORS.red : fuelLevel <= 4 ? COLORS.orange : COLORS.green;
          pdf.setFillColor(...fillColor);
          pdf.roundedRect(gaugeX, barY, fillW, gaugeH, 1.5, 1.5, 'F');
        }
        // Labels
        pdf.setFontSize(6);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text('E', gaugeX - 3, barY + 3.5);
        pdf.text('F', gaugeX + gaugeW + 2, barY + 3.5);

        yPos = barY + gaugeH + 6;
      }

      // Notes
      if (inspection.notas) {
        yPos = ensureSpace(pdf, yPos, 20);
        pdf.setFontSize(6.5);
        pdf.setFont(PDF_FONT, 'bold');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text('OBSERVACIONES', MARGIN_LEFT, yPos);
        yPos += 4;

        pdf.setFillColor(...COLORS.bgSubtle);
        pdf.setDrawColor(...COLORS.border);
        const notesLines = pdf.splitTextToSize(inspection.notas, contentWidth - 10);
        const notesH = notesLines.length * 4 + 6;
        pdf.roundedRect(MARGIN_LEFT, yPos, contentWidth, notesH, 1.5, 1.5, 'FD');

        pdf.setFontSize(8.5);
        pdf.setFont(PDF_FONT, 'normal');
        pdf.setTextColor(...COLORS.slate);
        pdf.text(notesLines, MARGIN_LEFT + 5, yPos + 5);
        yPos += notesH + 6;
      }

      yPos += 2;

      // ═══════════════════════════════════════════════════════
      // DAMAGES TABLE
      // ═══════════════════════════════════════════════════════
      const damages = inspection.damages || [];
      if (damages.length > 0) {
        yPos = ensureSpace(pdf, yPos, 30);
        yPos = drawSectionTitle(pdf, `DAÑOS REGISTRADOS (${damages.length})`, yPos);

        const getZoneLabel = (zona: string) =>
          DAMAGE_ZONES.find(z => z.key === zona)?.label || zona;

        autoTable(pdf, {
          startY: yPos,
          head: [['Zona', 'Pieza', 'Severidad', 'Descripción']],
          body: damages.map(d => [
            getZoneLabel(d.zona),
            d.pieza || '—',
            SEVERITY_CONFIG[d.severidad]?.label || d.severidad,
            d.descripcion || '—',
          ]),
          margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
          styles: {
            font: PDF_FONT,
            fontSize: 8,
            cellPadding: 3,
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
            0: { cellWidth: 32 },
            1: { cellWidth: 38 },
            2: { cellWidth: 22 },
            3: { cellWidth: 'auto' },
          },
          didParseCell: (data) => {
            // Color-code severity column
            if (data.section === 'body' && data.column.index === 2) {
              const severity = damages[data.row.index]?.severidad;
              const cfg = SEVERITY_CONFIG[severity];
              if (cfg) {
                data.cell.styles.textColor = cfg.color;
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });

        yPos = (pdf as any).lastAutoTable.finalY + 8;
      }

      // ═══════════════════════════════════════════════════════
      // PHOTOGRAPHS — grouped by category, 2-column grid
      // ═══════════════════════════════════════════════════════
      const photos = inspection.photos || [];
      if (photos.length > 0) {
        yPos = ensureSpace(pdf, yPos, 30);
        yPos = drawSectionTitle(pdf, `FOTOGRAFÍAS (${photos.length})`, yPos);

        const photoMaxW = (contentWidth - 8) / 2;
        const photoMaxH = 55;
        const PHOTO_ROW_GAP = 5;
        const PHOTO_PLACEHOLDER_H = 30;

        // Group photos by category following PHOTO_CATEGORY_GROUPS order
        const orderedCategories = [
          ...PHOTO_CATEGORY_GROUPS.flatMap(g => g.items.map(i => i.key)),
        ];
        // Add any categories not in groups
        const allCatKeys = Array.from(new Set(photos.map(p => p.photo_category)));
        for (const k of allCatKeys) {
          if (!orderedCategories.includes(k)) orderedCategories.push(k);
        }

        for (const catKey of orderedCategories) {
          const catPhotos = photos.filter(p => p.photo_category === catKey);
          if (catPhotos.length === 0) continue;

          const catLabel = PHOTO_CATEGORIES.find(c => c.key === catKey)?.label || catKey;

          // Pre-load images
          const loadedImages: Array<{
            base64: string | null;
            drawW: number;
            drawH: number;
            label: string;
          }> = [];

          for (const photo of catPhotos) {
            const signedUrl = await getSignedUrl(photo.storage_path);
            let base64: string | null = null;
            if (signedUrl) {
              base64 = await loadImageAsBase64(signedUrl);
            }

            if (base64) {
              try {
                const imgProps = pdf.getImageProperties(base64);
                const ratio = imgProps.width / imgProps.height;
                let drawW = photoMaxW;
                let drawH = drawW / ratio;
                if (drawH > photoMaxH) {
                  drawH = photoMaxH;
                  drawW = drawH * ratio;
                }
                loadedImages.push({ base64, drawW, drawH, label: photo.description || photo.file_name });
              } catch {
                loadedImages.push({
                  base64: null,
                  drawW: photoMaxW,
                  drawH: PHOTO_PLACEHOLDER_H,
                  label: photo.file_name,
                });
              }
            } else {
              loadedImages.push({
                base64: null,
                drawW: photoMaxW,
                drawH: PHOTO_PLACEHOLDER_H,
                label: photo.file_name,
              });
            }
          }

          // Group into rows of 2
          const rows: typeof loadedImages[] = [];
          for (let i = 0; i < loadedImages.length; i += 2) {
            rows.push(loadedImages.slice(i, i + 2));
          }

          // Category subtitle
          const firstRowH = rows.length > 0 ? Math.max(...rows[0].map(img => img.drawH)) : 0;
          yPos = ensureSpace(pdf, yPos, 10 + firstRowH + PHOTO_ROW_GAP);

          // Category label with gold accent
          pdf.setFontSize(8);
          pdf.setFont(PDF_FONT, 'bold');
          pdf.setTextColor(...COLORS.navy);
          pdf.text(catLabel.toUpperCase(), MARGIN_LEFT, yPos);
          pdf.setDrawColor(...COLORS.gold);
          pdf.setLineWidth(0.4);
          pdf.line(MARGIN_LEFT, yPos + 1.2, MARGIN_LEFT + pdf.getTextWidth(catLabel.toUpperCase()) + 2, yPos + 1.2);
          yPos += 5;

          // Draw rows
          for (const row of rows) {
            const rowH = Math.max(...row.map(img => img.drawH));
            yPos = ensureSpace(pdf, yPos, rowH + PHOTO_ROW_GAP + 4);

            row.forEach((img, colIdx) => {
              const xPos = MARGIN_LEFT + colIdx * (photoMaxW + 8);

              if (img.base64) {
                // Subtle border
                pdf.setDrawColor(...COLORS.border);
                pdf.setLineWidth(0.3);
                pdf.roundedRect(xPos - 0.5, yPos - 0.5, img.drawW + 1, img.drawH + 1, 1, 1, 'S');
                pdf.addImage(img.base64, 'JPEG', xPos, yPos, img.drawW, img.drawH);
              } else {
                // Placeholder
                pdf.setFillColor(...COLORS.bgSubtle);
                pdf.setDrawColor(...COLORS.border);
                pdf.roundedRect(xPos, yPos, photoMaxW, PHOTO_PLACEHOLDER_H, 1, 1, 'FD');
                pdf.setFontSize(7);
                pdf.setFont(PDF_FONT, 'normal');
                pdf.setTextColor(...COLORS.lightGray);
                pdf.text('Imagen no disponible', xPos + photoMaxW / 2, yPos + PHOTO_PLACEHOLDER_H / 2, {
                  align: 'center',
                });
              }
            });

            yPos += rowH + PHOTO_ROW_GAP;
          }

          yPos += 3;
        }
      }

      // ═══════════════════════════════════════════════════════
      // SUMMARY FOOTER SECTION
      // ═══════════════════════════════════════════════════════
      yPos = ensureSpace(pdf, yPos, 25);
      yPos += 5;
      drawHLine(pdf, yPos, COLORS.navy, 0.4);
      yPos += 6;

      // Summary stats
      pdf.setFontSize(7.5);
      pdf.setFont(PDF_FONT, 'normal');
      pdf.setTextColor(...COLORS.coolGray);
      const statsText = [
        `Fotos: ${photos.length}`,
        `Daños: ${damages.length}`,
        `Inspector: ${inspectorName}`,
      ].join('   |   ');
      pdf.text(statsText, MARGIN_LEFT, yPos);

      // ═══════════════════════════════════════════════════════
      // FOOTER on ALL pages
      // ═══════════════════════════════════════════════════════
      drawFootersOnAllPages(pdf, settings.footer_text || undefined);

      // Save
      const plate = vehicle?.matricula || 'vehiculo';
      const dateStr = inspection.inspection_date
        ? format(new Date(inspection.inspection_date), 'yyyyMMdd')
        : format(new Date(), 'yyyyMMdd');
      const fileName = `Inspeccion_${inspType}_${plate}_${dateStr}.pdf`;
      pdf.save(fileName);

      toast.success(`PDF de inspección generado correctamente`);
    } catch (error) {
      console.error('Error generating inspection PDF:', error);
      toast.error('Error al generar el PDF de inspección');
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
