import { useState, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { DocSection } from '@/data/technicalDocs';

interface UsePdfExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
}

export function usePdfExport(options: UsePdfExportOptions) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = useCallback(async (sections: DocSection[]) => {
    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Cover page
      pdf.setFillColor(34, 34, 34);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Logo placeholder
      pdf.setFillColor(99, 102, 241);
      pdf.roundedRect(margin, 40, 20, 20, 4, 4, 'F');
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(32);
      pdf.setFont('helvetica', 'bold');
      pdf.text(options.title, margin, 90);
      
      if (options.subtitle) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(180, 180, 180);
        pdf.text(options.subtitle, margin, 105);
      }
      
      // Date
      pdf.setFontSize(12);
      pdf.setTextColor(150, 150, 150);
      const date = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      pdf.text(`Generado el ${date}`, margin, pageHeight - 30);
      
      // Version
      pdf.text('Versión 1.0', margin, pageHeight - 20);
      
      // Table of contents
      pdf.addPage();
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      pdf.setTextColor(34, 34, 34);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tabla de Contenidos', margin, 30);
      
      let tocY = 50;
      let pageNumber = 3;
      const tocEntries: { title: string; page: number }[] = [];
      
      sections.forEach((section, sectionIndex) => {
        tocEntries.push({ title: section.title, page: pageNumber });
        
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(34, 34, 34);
        pdf.text(`${sectionIndex + 1}. ${section.title}`, margin, tocY);
        
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(String(pageNumber), pageWidth - margin - 10, tocY);
        
        tocY += 8;
        
        section.subsections.forEach((sub) => {
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(`    ${sub.title}`, margin, tocY);
          tocY += 6;
        });
        
        tocY += 6;
        pageNumber++;
      });
      
      // Content pages
      sections.forEach((section, sectionIndex) => {
        pdf.addPage();
        
        // Section header
        pdf.setFillColor(245, 245, 250);
        pdf.rect(0, 0, pageWidth, 50, 'F');
        
        pdf.setFillColor(99, 102, 241);
        pdf.roundedRect(margin, 15, 12, 12, 2, 2, 'F');
        
        pdf.setTextColor(34, 34, 34);
        pdf.setFontSize(20);
        pdf.setFont('helvetica', 'bold');
        pdf.text(section.title, margin + 18, 25);
        
        if (section.description) {
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(100, 100, 100);
          pdf.text(section.description, margin + 18, 35);
        }
        
        let y = 65;
        
        section.subsections.forEach((sub, subIndex) => {
          if (y > pageHeight - 40) {
            pdf.addPage();
            y = margin;
          }
          
          // Subsection title
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(34, 34, 34);
          pdf.text(sub.title, margin, y);
          y += 8;
          
          // Difficulty badge
          if (sub.difficulty) {
            const difficultyColors: Record<string, [number, number, number]> = {
              basic: [34, 197, 94],
              intermediate: [234, 179, 8],
              advanced: [249, 115, 22],
            };
            const color = difficultyColors[sub.difficulty] || [150, 150, 150];
            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.roundedRect(margin, y - 3, 20, 5, 1, 1, 'F');
            pdf.setFontSize(7);
            pdf.setTextColor(255, 255, 255);
            pdf.text(sub.difficulty, margin + 2, y + 1);
            y += 8;
          }
          
          // Content - simplified rendering
          const cleanContent = sub.content
            .replace(/:::(tip|warning|info|code|api|security|admin)/g, '')
            .replace(/:::/g, '')
            .replace(/\*\*/g, '')
            .replace(/`/g, '')
            .trim();
          
          const lines = cleanContent.split('\n').filter(line => line.trim());
          
          lines.forEach((line) => {
            if (y > pageHeight - 20) {
              pdf.addPage();
              y = margin;
            }
            
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('## ')) {
              pdf.setFontSize(13);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(34, 34, 34);
              pdf.text(trimmedLine.slice(3), margin, y);
              y += 7;
            } else if (trimmedLine.startsWith('### ')) {
              pdf.setFontSize(11);
              pdf.setFont('helvetica', 'bold');
              pdf.setTextColor(60, 60, 60);
              pdf.text(trimmedLine.slice(4), margin, y);
              y += 6;
            } else if (trimmedLine.startsWith('- ')) {
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(80, 80, 80);
              const text = `• ${trimmedLine.slice(2)}`;
              const splitText = pdf.splitTextToSize(text, contentWidth - 10);
              pdf.text(splitText, margin + 5, y);
              y += splitText.length * 5;
            } else if (trimmedLine.startsWith('|')) {
              // Skip table formatting lines
              if (!trimmedLine.match(/^\|[-|]+\|$/)) {
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(60, 60, 60);
                pdf.text(trimmedLine.replace(/\|/g, '  '), margin, y);
                y += 5;
              }
            } else if (trimmedLine) {
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(80, 80, 80);
              const splitText = pdf.splitTextToSize(trimmedLine, contentWidth);
              pdf.text(splitText, margin, y);
              y += splitText.length * 5;
            }
          });
          
          y += 10;
        });
        
        // Footer with page number
        pdf.setFontSize(9);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `${sectionIndex + 3}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      });
      
      // Save
      pdf.save(`${options.filename}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [options]);

  return {
    generatePdf,
    isGenerating,
  };
}
