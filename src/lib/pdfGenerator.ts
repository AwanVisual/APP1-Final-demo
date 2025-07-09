import jsPDF from 'jspdf';

interface CartItem {
  product: any;
  quantity: number;
  customDiscount: number;
}

interface SaleData {
  id: string;
  sale_number: string;
  created_at: string;
  customer_name?: string;
  total_amount: number;
  payment_method: string;
  payment_received: number;
  change_amount: number;
  notes?: string;
}

interface Settings {
  company_logo?: string;
  store_name?: string;
  store_address?: string;
  store_phone?: string;
  store_email?: string;
  store_website?: string;
  receipt_header?: string;
  receipt_footer?: string;
  payment_note_line1?: string;
  payment_note_line2?: string;
}

interface ReceiptFieldsConfig {
  showAmount: boolean;
  showDppFaktur: boolean;
  showDiscount: boolean;
  showPpn11: boolean;
  discountPercentage: number;
}

export const generateInvoicePDF = async (
  sale: SaleData,
  cart: CartItem[],
  settings: Settings,
  receiptConfig: ReceiptFieldsConfig,
  selectedCashier: string,
  userEmail?: string
) => {
  // Create PDF with half paper size (A5 landscape or custom size)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [210, 148] // Half A4 size (A5)
  });

  const salesName = selectedCashier || userEmail || "Unknown";

  // Calculate detailed pricing
  const calculateDetailedPricing = (item: CartItem) => {
    const price = Number(item.product.price);
    const quantity = item.quantity;
    const itemDiscount = item.customDiscount || 0;

    const amount = quantity * price;
    const dpp11 = (100 / 111) * price;
    const discount = (itemDiscount / 100) * dpp11;
    const dppFaktur = dpp11 - discount;
    const ppn11 = 0.11 * dppFaktur;

    return {
      amount,
      dpp11: dpp11 * quantity,
      discount: discount * quantity,
      dppFaktur: dppFaktur * quantity,
      ppn11: ppn11 * quantity,
      finalItemTotal: (dppFaktur + ppn11) * quantity,
    };
  };

  const detailedTotals = cart.reduce(
    (totals, item) => {
      const itemCalc = calculateDetailedPricing(item);
      return {
        amount: totals.amount + itemCalc.amount,
        discount: totals.discount + itemCalc.discount,
        dppFaktur: totals.dppFaktur + itemCalc.dppFaktur,
        ppn11: totals.ppn11 + itemCalc.ppn11,
      };
    },
    { amount: 0, discount: 0, dppFaktur: 0, ppn11: 0 }
  );

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Set font
  pdf.setFont('helvetica');

  // Header section
  let yPos = 15;
  
  // Company logo (if available)
  if (settings.company_logo) {
    try {
      // Note: In a real implementation, you'd need to convert the image to base64
      // For now, we'll skip the logo and just add space
      yPos += 20;
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  // Invoice title
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INVOICE', 150, yPos);
  
  // Company info (right side)
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  let companyYPos = yPos + 10;
  
  if (settings.store_name) {
    pdf.text(settings.store_name, 150, companyYPos);
    companyYPos += 5;
  }
  if (settings.store_address) {
    const addressLines = pdf.splitTextToSize(settings.store_address, 50);
    pdf.text(addressLines, 150, companyYPos);
    companyYPos += addressLines.length * 5;
  }
  if (settings.store_phone) {
    pdf.text(settings.store_phone, 150, companyYPos);
    companyYPos += 5;
  }
  if (settings.store_email) {
    pdf.text(settings.store_email, 150, companyYPos);
    companyYPos += 5;
  }
  if (settings.store_website) {
    pdf.text(settings.store_website, 150, companyYPos);
  }

  // Invoice details (left side)
  yPos += 25;
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('NO INVOICE:', 15, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(sale.sale_number, 50, yPos);
  
  yPos += 7;
  pdf.setFont('helvetica', 'bold');
  pdf.text('TANGGAL:', 15, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(new Date(sale.created_at).toLocaleDateString("id-ID"), 50, yPos);
  
  if (sale.customer_name) {
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('KEPADA:', 15, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(sale.customer_name, 50, yPos);
  }
  
  yPos += 7;
  pdf.setFont('helvetica', 'bold');
  pdf.text('NAMA SALES:', 15, yPos);
  pdf.setFont('helvetica', 'normal');
  pdf.text(salesName, 50, yPos);

  // Table header
  yPos += 15;
  const tableStartY = yPos;
  
  // Draw table header
  pdf.setFillColor(248, 249, 250);
  pdf.rect(15, yPos - 5, 180, 10, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('KETERANGAN', 17, yPos);
  pdf.text('QTY', 90, yPos);
  pdf.text('HARGA', 110, yPos);
  pdf.text('DISCOUNT', 135, yPos);
  pdf.text('TOTAL', 170, yPos);
  
  // Draw header border
  pdf.setLineWidth(0.5);
  pdf.line(15, yPos + 2, 195, yPos + 2);
  
  yPos += 10;

  // Table content
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  
  cart.forEach((item) => {
    const itemCalc = calculateDetailedPricing(item);
    
    // Product name
    const productName = pdf.splitTextToSize(item.product.name, 70);
    pdf.text(productName, 17, yPos);
    
    // Quantity
    pdf.text(item.quantity.toString(), 90, yPos);
    
    // Price
    pdf.text(formatCurrency(Number(item.product.price)), 110, yPos);
    
    // Discount
    if (item.customDiscount > 0) {
      pdf.text(`${item.customDiscount}%`, 135, yPos);
      pdf.text(`-${formatCurrency(itemCalc.discount)}`, 135, yPos + 4);
    } else {
      pdf.text('-', 135, yPos);
    }
    
    // Total
    pdf.text(formatCurrency(itemCalc.finalItemTotal), 170, yPos);
    
    yPos += Math.max(productName.length * 4, 8);
    
    // Draw row separator
    pdf.setLineWidth(0.1);
    pdf.line(15, yPos, 195, yPos);
    yPos += 3;
  });

  // Payment note section (left side)
  yPos += 10;
  const paymentNoteY = yPos;
  
  pdf.setFillColor(248, 249, 250);
  pdf.rect(15, yPos - 5, 80, 25, 'F');
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(217, 83, 79); // Red color
  pdf.text('CATATAN PEMBAYARAN:', 17, yPos);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  yPos += 7;
  
  const paymentNote1 = settings.payment_note_line1 || `Harga BCA : ${formatCurrency(Math.round(detailedTotals.dppFaktur / cart.length))}/PUTRA INDRAWAN`;
  const paymentNote2 = settings.payment_note_line2 || "No. Rekening: 7840656905";
  
  pdf.text(paymentNote1, 17, yPos);
  yPos += 5;
  pdf.text(paymentNote2, 17, yPos);

  // Totals section (right side)
  let totalsY = paymentNoteY;
  const totalsX = 120;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  
  if (receiptConfig.showAmount) {
    pdf.text('SUB TOTAL:', totalsX, totalsY);
    pdf.text(formatCurrency(detailedTotals.amount), 170, totalsY);
    totalsY += 6;
  }
  
  if (detailedTotals.discount > 0) {
    pdf.text('Total Discount:', totalsX, totalsY);
    pdf.text(`-${formatCurrency(detailedTotals.discount)}`, 170, totalsY);
    totalsY += 6;
  }
  
  if (receiptConfig.showDppFaktur) {
    pdf.text('DPP Faktur:', totalsX, totalsY);
    pdf.text(formatCurrency(detailedTotals.dppFaktur), 170, totalsY);
    totalsY += 6;
  }
  
  if (receiptConfig.showPpn11) {
    pdf.text('PPN 11%:', totalsX, totalsY);
    pdf.text(formatCurrency(detailedTotals.ppn11), 170, totalsY);
    totalsY += 6;
  }
  
  // Final total
  totalsY += 5;
  pdf.setLineWidth(0.5);
  pdf.line(totalsX, totalsY - 3, 195, totalsY - 3);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(12);
  pdf.text('TOTAL:', totalsX, totalsY);
  pdf.text(formatCurrency(sale.total_amount), 170, totalsY);

  // Footer
  if (settings.receipt_header || settings.receipt_footer) {
    yPos = 130; // Near bottom of page
    pdf.setLineWidth(0.5);
    pdf.line(15, yPos, 195, yPos);
    yPos += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    
    if (settings.receipt_header) {
      pdf.text(settings.receipt_header, 105, yPos, { align: 'center' });
      yPos += 5;
    }
    if (settings.receipt_footer) {
      pdf.text(settings.receipt_footer, 105, yPos, { align: 'center' });
    }
  }

  return pdf;
};

export const downloadInvoicePDF = async (
  sale: SaleData,
  cart: CartItem[],
  settings: Settings,
  receiptConfig: ReceiptFieldsConfig,
  selectedCashier: string,
  userEmail?: string
) => {
  const pdf = await generateInvoicePDF(sale, cart, settings, receiptConfig, selectedCashier, userEmail);
  pdf.save(`Invoice-${sale.sale_number}.pdf`);
};

export const printInvoicePDF = async (
  sale: SaleData,
  cart: CartItem[],
  settings: Settings,
  receiptConfig: ReceiptFieldsConfig,
  selectedCashier: string,
  userEmail?: string
) => {
  const pdf = await generateInvoicePDF(sale, cart, settings, receiptConfig, selectedCashier, userEmail);
  
  // Create blob URL and open in new window for printing
  const pdfBlob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  
  const printWindow = window.open(blobUrl, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
      // Clean up the blob URL after printing
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl);
      }, 1000);
    };
  }
};