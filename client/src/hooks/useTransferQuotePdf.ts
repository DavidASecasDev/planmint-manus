import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTransferInvoiceSettings } from './useTransferInvoiceSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import type { TransferRequest, TransferItem, TransferItemVehicle } from '@/types/transfers';
import { calculateClientInvoice } from '@/utils/transferCalculations';
import { getVehicleInfo } from '@/lib/transferPricing';

type DocumentType = 'quote' | 'invoice';
export type PdfLanguage = 'es' | 'en';

interface GenerateOptions {
  request: TransferRequest;
  items: TransferItem[];
  documentType: DocumentType;
  language: PdfLanguage;
}

// Premium Translations
const TRANSLATIONS: Record<PdfLanguage, Record<string, string>> = {
  es: {
    quote: 'PRESUPUESTO',
    invoice: 'FACTURA',
    client: 'CLIENTE',
    date: 'FECHA',
    reference: 'REFERENCIA',
    route: 'TRAYECTO',
    vehicle: 'VEHÍCULO',
    price: 'PRECIO',
    subtotal: 'SUBTOTAL',
    vat: 'IVA',
    total: 'TOTAL',
    bankDetails: 'DATOS BANCARIOS',
    paymentMethod: 'MÉTODO DE PAGO',
    pax: 'PAX',
    validUntil: 'VÁLIDO HASTA',
    terms: 'CONDICIONES',
    transferService: 'Servicio de Transfer',
    successMessage: 'generado correctamente',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    bank: 'BANCO',
  },
  en: {
    quote: 'QUOTATION',
    invoice: 'INVOICE',
    client: 'CLIENT',
    date: 'DATE',
    reference: 'REFERENCE',
    route: 'ROUTE',
    vehicle: 'VEHICLE',
    price: 'PRICE',
    subtotal: 'SUBTOTAL',
    vat: 'VAT',
    total: 'TOTAL',
    bankDetails: 'BANK DETAILS',
    paymentMethod: 'PAYMENT METHOD',
    pax: 'PAX',
    validUntil: 'VALID UNTIL',
    terms: 'TERMS',
    transferService: 'Transfer Service',
    successMessage: 'generated successfully',
    iban: 'IBAN',
    swift: 'SWIFT/BIC',
    bank: 'BANK',
  },
};

// Premium Color Palette - Nautical Luxury
const COLORS = {
  // Primary - Deep Navy (main headers, emphasis)
  navy: [26, 54, 93] as [number, number, number],          // #1a365d
  navyLight: [44, 82, 130] as [number, number, number],    // #2c5282
  
  // Text hierarchy
  slate: [51, 65, 85] as [number, number, number],         // #334155
  coolGray: [100, 116, 139] as [number, number, number],   // #64748b
  lightGray: [148, 163, 184] as [number, number, number],  // #94a3b8
  
  // Backgrounds
  bgLight: [248, 250, 252] as [number, number, number],    // #f8fafc
  bgSubtle: [241, 245, 249] as [number, number, number],   // #f1f5f9
  white: [255, 255, 255] as [number, number, number],
  
  // Accent
  gold: [184, 134, 11] as [number, number, number],        // #b8860b (subtle luxury accent)
  
  // Lines
  border: [226, 232, 240] as [number, number, number],     // #e2e8f0
};

export function useTransferQuotePdf() {
  const { settings } = useTransferInvoiceSettings();
  const { profile } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount == null) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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

  const getNextDocumentNumber = async (docType: DocumentType): Promise<string> => {
    if (!profile?.organization_id) throw new Error('No organization');

    const { data, error } = await supabase.rpc('get_next_transfer_document_number', {
      p_organization_id: profile.organization_id,
      p_document_type: docType,
    });

    if (error) throw error;
    return data as string;
  };

  // Helper: Draw a subtle horizontal line
  const drawLine = (pdf: jsPDF, y: number, marginLeft: number, marginRight: number, color: [number, number, number] = COLORS.border) => {
    pdf.setDrawColor(...color);
    pdf.setLineWidth(0.3);
    pdf.line(marginLeft, y, pdf.internal.pageSize.getWidth() - marginRight, y);
  };

  // Helper: Draw section label with underline
  const drawSectionLabel = (pdf: jsPDF, label: string, x: number, y: number) => {
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...COLORS.coolGray);
    pdf.text(label, x, y);
    // Small underline accent
    pdf.setDrawColor(...COLORS.gold);
    pdf.setLineWidth(0.5);
    pdf.line(x, y + 1.5, x + pdf.getTextWidth(label), y + 1.5);
  };

  const generatePdf = async ({ request, items, documentType, language }: GenerateOptions) => {
    if (!settings) {
      toast.error('Configura los datos de facturación primero');
      return;
    }

    if (!settings.company_name || !settings.tax_id) {
      toast.error('Faltan datos fiscales obligatorios');
      return;
    }

    if (items.length === 0) {
      toast.error('No hay trayectos para incluir');
      return;
    }

    setIsGenerating(true);

    // Fetch additional vehicles for all items
    let additionalVehiclesMap: Record<string, TransferItemVehicle[]> = {};
    if (profile?.organization_id) {
      const itemIds = items.map(i => i.id);
      const { data: allVehicles } = await supabase
        .from('transfer_item_vehicles')
        .select('*')
        .in('transfer_item_id', itemIds)
        .eq('organization_id', profile.organization_id)
        .order('position');
      if (allVehicles) {
        for (const v of allVehicles as TransferItemVehicle[]) {
          if (!additionalVehiclesMap[v.transfer_item_id]) additionalVehiclesMap[v.transfer_item_id] = [];
          additionalVehiclesMap[v.transfer_item_id].push(v);
        }
      }
    }
    const t = TRANSLATIONS[language];
    const dateLocale = language === 'es' ? es : enUS;

    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Premium margins
      const marginLeft = 25;
      const marginRight = 25;
      const contentWidth = pageWidth - marginLeft - marginRight;
      
      let yPos = 25;

      // ═══════════════════════════════════════════════════════════
      // HEADER SECTION - Logo left, Company info right
      // ═══════════════════════════════════════════════════════════
      
      const headerStartY = yPos;
      
      // Logo (left side) - larger for premium feel
      if (settings.logo_url) {
        try {
          const logoBase64 = await loadImageAsBase64(settings.logo_url);
          if (logoBase64) {
            // Aspect ratio preserved, max height 22mm
            pdf.addImage(logoBase64, 'PNG', marginLeft, yPos, 40, 20);
          }
        } catch (e) {
          console.error('Error loading logo:', e);
        }
      }

      // Company info (right aligned) - elegant typography
      const rightEdge = pageWidth - marginRight;
      
      // Company name - prominent
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(settings.company_name || '', rightEdge, yPos + 4, { align: 'right' });
      
      // Tax ID - subtle
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.slate);
      pdf.text(`CIF: ${settings.tax_id || ''}`, rightEdge, yPos + 10, { align: 'right' });
      
      // Address and contact - refined spacing
      let infoY = yPos + 16;
      pdf.setFontSize(8);
      pdf.setTextColor(...COLORS.coolGray);
      
      if (settings.address) {
        const addressLines = pdf.splitTextToSize(settings.address, 75);
        addressLines.forEach((line: string) => {
          pdf.text(line, rightEdge, infoY, { align: 'right' });
          infoY += 3.5;
        });
      }
      
      if (settings.phone) {
        pdf.text(`Tel: ${settings.phone}`, rightEdge, infoY, { align: 'right' });
        infoY += 3.5;
      }
      
      if (settings.email) {
        pdf.text(settings.email, rightEdge, infoY, { align: 'right' });
      }

      yPos = Math.max(headerStartY + 28, infoY + 5);

      // Elegant header divider
      drawLine(pdf, yPos, marginLeft, marginRight, COLORS.border);
      yPos += 12;

      // ═══════════════════════════════════════════════════════════
      // DOCUMENT TITLE - Elegant centered
      // ═══════════════════════════════════════════════════════════
      
      const documentNumber = await getNextDocumentNumber(documentType);
      const docTitle = documentType === 'quote' ? t.quote : t.invoice;
      
      // Title with letter spacing effect
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.navy);
      
      // Add letter spacing manually for premium look
      const titleWithSpacing = docTitle.split('').join(' ');
      pdf.text(titleWithSpacing, pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
      
      // Document number - accent color
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.navyLight);
      pdf.text(documentNumber, pageWidth / 2, yPos, { align: 'center' });
      yPos += 18;

      // ═══════════════════════════════════════════════════════════
      // CLIENT & DOCUMENT INFO - Two elegant boxes
      // ═══════════════════════════════════════════════════════════
      
      const boxHeight = 32;
      const boxGap = 12;
      const box1Width = contentWidth * 0.55;
      const box2Width = contentWidth - box1Width - boxGap;
      
      // Box 1: Client Info
      pdf.setFillColor(...COLORS.bgLight);
      pdf.roundedRect(marginLeft, yPos, box1Width, boxHeight, 3, 3, 'F');
      
      // Client label
      drawSectionLabel(pdf, t.client, marginLeft + 8, yPos + 8);
      
      // Client name - prominent
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.slate);
      pdf.text(request.client_name || '-', marginLeft + 8, yPos + 17);
      
      // Yacht name if available
      if (request.notes) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(...COLORS.coolGray);
        const yachtLine = request.notes.split('\n')[0]?.substring(0, 50) || '';
        if (yachtLine) {
          pdf.text(yachtLine, marginLeft + 8, yPos + 24);
        }
      }
      
      // Box 2: Document Info
      const box2X = marginLeft + box1Width + boxGap;
      pdf.setFillColor(...COLORS.bgLight);
      pdf.roundedRect(box2X, yPos, box2Width, boxHeight, 3, 3, 'F');
      
      // Date
      drawSectionLabel(pdf, t.date, box2X + 8, yPos + 8);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.slate);
      pdf.text(format(new Date(), 'dd MMMM yyyy', { locale: dateLocale }), box2X + 8, yPos + 15);
      
      // Reference
      drawSectionLabel(pdf, t.reference, box2X + 8, yPos + 22);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.navyLight);
      pdf.text(request.request_number || '-', box2X + 8, yPos + 29);
      
      yPos += boxHeight + 15;

      // ═══════════════════════════════════════════════════════════
      // ITEMS TABLE - Premium design
      // ═══════════════════════════════════════════════════════════
      
      const tableData = items
        .sort((a, b) => {
          if (!a.transfer_date && !b.transfer_date) return 0;
          if (!a.transfer_date) return 1;
          if (!b.transfer_date) return -1;
          const dateCompare = new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime();
          if (dateCompare !== 0) return dateCompare;
          if (!a.pickup_time && !b.pickup_time) return 0;
          if (!a.pickup_time) return 1;
          if (!b.pickup_time) return -1;
          return a.pickup_time.localeCompare(b.pickup_time);
        })
        .map((item) => {
          const route = [item.pickup_location, item.dropoff_location]
            .filter(Boolean)
            .join(' - ') || '-';
          
          const dateStr = item.transfer_date 
            ? format(new Date(item.transfer_date), 'dd MMM', { locale: dateLocale })
            : '-';
          const timeStr = item.pickup_time ? item.pickup_time.slice(0, 5) : '';
          const dateTime = timeStr ? `${dateStr}\n${timeStr}` : dateStr;

          const price = item.price_with_commission || item.base_price || 0;

          // Build vehicle display string including additional vehicles
          const additionalVehicles = additionalVehiclesMap[item.id] || [];
          const allVehicleLabels: string[] = [];
          if (item.vehicle_type) {
            allVehicleLabels.push(getVehicleInfo(item.vehicle_type)?.label || item.vehicle_type);
          }
          for (const av of additionalVehicles) {
            allVehicleLabels.push(getVehicleInfo(av.vehicle_type)?.label || av.vehicle_type);
          }
          const vehicleDisplay = allVehicleLabels.length > 0 ? allVehicleLabels.join('\n') : '-';

          return [
            dateTime,
            route,
            item.pax_count?.toString() || '-',
            vehicleDisplay,
            formatCurrency(price),
          ];
        });

      autoTable(pdf, {
        startY: yPos,
        head: [[t.date, t.route, t.pax, t.vehicle, t.price]],
        body: tableData,
        theme: 'plain',
        tableWidth: contentWidth,
        styles: {
          fontSize: 9,
          cellPadding: { top: 5, right: 4, bottom: 5, left: 4 },
          textColor: COLORS.slate,
          lineColor: COLORS.border,
          lineWidth: 0.1,
          overflow: 'linebreak',
          valign: 'middle',
        },
        headStyles: {
          fillColor: COLORS.navy,
          textColor: COLORS.white,
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 6, right: 4, bottom: 6, left: 4 },
          halign: 'center',
        },
        bodyStyles: {
          minCellHeight: 12,
        },
        alternateRowStyles: {
          fillColor: COLORS.bgSubtle,
        },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },  // Date - 22mm
          1: { cellWidth: 72, overflow: 'linebreak', fontSize: 8 },   // Route - 72mm, smaller font
          2: { cellWidth: 15, halign: 'center' },                     // Pax - 15mm
          3: { cellWidth: 26, halign: 'center' },                     // Vehicle - 26mm
          4: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: COLORS.navy },  // Price - 25mm
        },
        margin: { left: marginLeft, right: marginRight },
        didDrawCell: (data) => {
          // Add subtle bottom border to all body rows
          if (data.section === 'body') {
            pdf.setDrawColor(...COLORS.border);
            pdf.setLineWidth(0.2);
            pdf.line(
              data.cell.x,
              data.cell.y + data.cell.height,
              data.cell.x + data.cell.width,
              data.cell.y + data.cell.height
            );
          }
        },
      });

      // Get Y position after table
      const finalY = (pdf as any).lastAutoTable?.finalY || yPos + 50;
      yPos = finalY + 12;

      // ═══════════════════════════════════════════════════════════
      // TOTALS BOX - Premium right-aligned
      // ═══════════════════════════════════════════════════════════
      
      // Calculate totals using the transfer calculation utility
      const subtotal = items.reduce((sum, item) => sum + (item.price_with_commission || item.base_price || 0), 0);
      const vatRate = 21;
      const vatAmount = subtotal * 0.21;
      const total = request.client_total || (subtotal + vatAmount);

      const totalsBoxWidth = 85;
      const totalsBoxX = pageWidth - marginRight - totalsBoxWidth;
      
      // Totals container with subtle border
      const totalsBoxHeight = 42;
      pdf.setFillColor(...COLORS.bgLight);
      pdf.setDrawColor(...COLORS.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(totalsBoxX, yPos, totalsBoxWidth, totalsBoxHeight, 3, 3, 'FD');
      
      // Subtotal row
      const labelX = totalsBoxX + 8;
      const valueX = totalsBoxX + totalsBoxWidth - 8;
      let rowY = yPos + 10;
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text(t.subtotal, labelX, rowY);
      pdf.setTextColor(...COLORS.slate);
      pdf.text(formatCurrency(subtotal), valueX, rowY, { align: 'right' });
      
      // VAT row
      rowY += 8;
      pdf.setTextColor(...COLORS.coolGray);
      pdf.text(`${t.vat} (${vatRate}%)`, labelX, rowY);
      pdf.setTextColor(...COLORS.slate);
      pdf.text(formatCurrency(vatAmount), valueX, rowY, { align: 'right' });
      
      // Divider before total
      rowY += 5;
      pdf.setDrawColor(...COLORS.navy);
      pdf.setLineWidth(0.5);
      pdf.line(labelX, rowY, valueX, rowY);
      
      // Total row - prominent
      rowY += 9;
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...COLORS.navy);
      pdf.text(t.total, labelX, rowY);
      pdf.setFontSize(13);
      pdf.text(formatCurrency(total), valueX, rowY, { align: 'right' });

      // ═══════════════════════════════════════════════════════════
      // VALIDITY (for quotes only)
      // ═══════════════════════════════════════════════════════════
      
      if (documentType === 'quote') {
        yPos += totalsBoxHeight + 10;
        const validUntil = addDays(new Date(), 15);
        
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.text(
          `${t.validUntil}: ${format(validUntil, 'dd MMMM yyyy', { locale: dateLocale })}`,
          pageWidth - marginRight,
          yPos,
          { align: 'right' }
        );
      }

      // ═══════════════════════════════════════════════════════════
      // FOOTER - Professional bank details and terms
      // ═══════════════════════════════════════════════════════════
      
      // Calculate safe footer position - ensure it's below all content
      const contentEndY = yPos + totalsBoxHeight + 15;
      const footerStartY = Math.max(contentEndY, pageHeight - 48);
      
      // Only draw footer if there's space, otherwise it goes on the page bottom
      const actualFooterY = Math.min(footerStartY, pageHeight - 35);
      
      // Elegant footer divider
      drawLine(pdf, actualFooterY, marginLeft, marginRight, COLORS.border);
      let footerContentY = actualFooterY + 6;

      // Bank details in structured format (left side)
      if (settings.bank_details) {
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...COLORS.slate);
        pdf.text(t.bankDetails, marginLeft, footerContentY);
        
        let bankY = footerContentY + 4;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...COLORS.coolGray);
        pdf.setFontSize(7);
        
        // Parse bank details for better formatting
        const bankLines = settings.bank_details.split('\n').slice(0, 3);
        bankLines.forEach((line) => {
          pdf.text(line.trim(), marginLeft, bankY);
          bankY += 3.2;
        });
      }

      // Footer text / conditions - centered below content
      if (settings.footer_text) {
        const footerMaxWidth = contentWidth * 0.8;
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'italic');
        pdf.setTextColor(...COLORS.lightGray);
        const footerLines = pdf.splitTextToSize(settings.footer_text, footerMaxWidth);
        pdf.text(footerLines, pageWidth / 2, footerContentY + 12, { align: 'center' });
      }

      // Page number
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...COLORS.lightGray);
      pdf.text('1 / 1', pageWidth / 2, pageHeight - 10, { align: 'center' });

      // ═══════════════════════════════════════════════════════════
      // SAVE PDF
      // ═══════════════════════════════════════════════════════════
      
      const fileName = `${documentNumber}.pdf`;
      pdf.save(fileName);

      toast.success(`${docTitle} ${documentNumber} ${t.successMessage}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el documento');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateQuotePdf = (request: TransferRequest, items: TransferItem[], language: PdfLanguage = 'es') => {
    return generatePdf({ request, items, documentType: 'quote', language });
  };

  const generateInvoicePdf = (request: TransferRequest, items: TransferItem[], language: PdfLanguage = 'es') => {
    return generatePdf({ request, items, documentType: 'invoice', language });
  };

  return {
    generateQuotePdf,
    generateInvoicePdf,
    isGenerating,
    settingsComplete: !!(settings?.company_name && settings?.tax_id),
  };
}
