
import { jsPDF } from "jspdf";
import { format } from "date-fns";

// Invoice data type
export interface InvoiceData {
  id: string;
  number: string; // Adding the number property that's being used in InvoiceList.tsx
  client: string;
  property: string;
  date: string;
  dueDate: string;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  services: string[];
  paymentMethod: string;

  // Optional fields filled when data comes from the backend
  invoiceNumber?: string;
  client_id?: number;
  photographer?: string;
  photographer_id?: number;
  salesRep?: string;
  sales_rep_id?: number;
  amountPaid?: number;
  balance?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  issueDate?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  createdAt?: string;
  paidAt?: string;
  shootsCount?: number;
  shoot_id?: number;
  shoot?: any;
  items?: Array<{
    id?: number | string;
    description?: string;
    quantity?: number;
    unit_amount?: number;
    total_amount?: number;
    [key: string]: any;
  }>;
  notes?: string;
}

export const generateInvoicePDF = (invoice: InvoiceData): void => {
  // Create a new PDF document
  const doc = new jsPDF();
  
  // Set company information
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ACME Real Estate Photography", 20, 20);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("123 Business Street", 20, 27);
  doc.text("Cityville, State 12345", 20, 32);
  doc.text("Phone: (555) 123-4567", 20, 37);
  doc.text("Email: billing@acmephotography.com", 20, 42);
  
  // Add invoice details
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`INVOICE #${invoice.id}`, 140, 20, { align: "right" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${format(new Date(invoice.date), "MM/dd/yyyy")}`, 140, 27, { align: "right" });
  doc.text(`Due Date: ${format(new Date(invoice.dueDate), "MM/dd/yyyy")}`, 140, 32, { align: "right" });
  
  const statusColor = 
    invoice.status === "paid" ? "#00AA00" : 
    invoice.status === "pending" ? "#FF9900" : "#FF0000";
  
  doc.setTextColor(statusColor);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Status: ${invoice.status.toUpperCase()}`, 
    140, 
    37, 
    { align: "right" }
  );
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  
  // Bill to section
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, 55);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.client, 20, 62);
  doc.text(invoice.property, 20, 67);
  
  // Services table
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Services", 20, 80);
  doc.text("Qty", 140, 80);
  doc.text("Price", 170, 80);
  
  // Draw table header line
  doc.line(20, 83, 190, 83);
  
  // Services items
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  let yPos = 90;
  const servicePrice = invoice.amount / invoice.services.length;
  
  invoice.services.forEach((service, index) => {
    doc.text(service, 20, yPos);
    doc.text("1", 140, yPos);
    doc.text(`$${servicePrice.toFixed(2)}`, 170, yPos);
    yPos += 8;
  });
  
  // Draw table footer line
  doc.line(20, yPos, 190, yPos);
  yPos += 8;
  
  // Totals
  doc.setFont("helvetica", "bold");
  doc.text("Subtotal:", 140, yPos);
  doc.text(`$${invoice.amount.toFixed(2)}`, 170, yPos);
  yPos += 8;
  
  doc.text("Tax:", 140, yPos);
  doc.text("$0.00", 170, yPos);
  yPos += 8;
  
  doc.text("Total:", 140, yPos);
  doc.text(`$${invoice.amount.toFixed(2)}`, 170, yPos);
  yPos += 15;
  
  // Payment info
  doc.setFontSize(10);
  doc.text("Payment Method:", 20, yPos);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.paymentMethod, 70, yPos);
  
  yPos += 15;
  
  // Thank you message
  doc.setFontSize(10);
  doc.text("Thank you for your business!", 20, yPos);
  
  // Payment instructions
  yPos += 10;
  doc.text("Payment is due within 15 days of invoice date.", 20, yPos);
  
  // Footer
  doc.setFontSize(8);
  doc.text("For questions about this invoice, please contact billing@acmephotography.com", 105, 280, { align: "center" });
  
  // Save the PDF with the invoice number as the filename
  doc.save(`Invoice-${invoice.id}.pdf`);
};
