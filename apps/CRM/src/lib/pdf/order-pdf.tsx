import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { registerFonts } from "./fonts";
import {
  pdfFormatCurrency,
  pdfFormatDate,
  getDefaultCompanyInfo,
  type CompanyInfo,
} from "./utils";

registerFonts();

export interface OrderPDFData {
  orderNumber: string;
  status: string;
  createdAt: string | Date;
  paidAt?: string | Date | null;
  shippedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  shippingAddress?: string | null;
  notes?: string | null;
  company?: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  deal?: {
    title: string;
  } | null;
  quote?: {
    quoteNumber: string;
  } | null;
  createdBy?: {
    name: string | null;
  } | null;
  items: Array<{
    product?: { name: string } | null;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  IN_PRODUCTION: "Đang sản xuất",
  SHIPPED: "Đã giao",
  DELIVERED: "Đã nhận",
  CANCELLED: "Đã hủy",
  REFUNDED: "Hoàn tiền",
};

interface OrderPDFProps {
  order: OrderPDFData;
  companyInfo?: CompanyInfo;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    fontSize: 10,
    padding: 40,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  companyInfo: {
    flex: 1,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 700,
    color: "#2563EB",
    marginBottom: 4,
  },
  companyDetail: {
    fontSize: 9,
    color: "#6B7280",
    marginBottom: 2,
  },
  titleBlock: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: "#2563EB",
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 2,
  },
  statusBadge: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    fontSize: 9,
    fontWeight: 700,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "#1F2937",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  infoBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 4,
    padding: 12,
    marginBottom: 20,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  infoItem: {
    width: "50%",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 8,
    color: "#6B7280",
    marginBottom: 1,
  },
  infoValue: {
    fontSize: 9,
    color: "#1F2937",
  },
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2563EB",
    padding: 6,
    borderRadius: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 700,
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E7EB",
    padding: 6,
    minHeight: 24,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#F9FAFB",
  },
  tableCell: {
    fontSize: 9,
    color: "#374151",
  },
  colNum: { width: "6%" },
  colProduct: { width: "36%" },
  colQty: { width: "12%", textAlign: "right" },
  colPrice: { width: "22%", textAlign: "right" },
  colTotal: { width: "24%", textAlign: "right" },
  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  totalsBox: {
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: 9,
    color: "#6B7280",
  },
  totalValue: {
    fontSize: 9,
    color: "#1F2937",
    textAlign: "right",
  },
  totalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#2563EB",
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "#1F2937",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: 700,
    color: "#2563EB",
    textAlign: "right",
  },
  notesSection: {
    marginTop: 20,
  },
  notesText: {
    fontSize: 9,
    color: "#374151",
    lineHeight: 1.6,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E7EB",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#9CA3AF",
  },
});

export function OrderPDF({ order, companyInfo }: OrderPDFProps) {
  const company = companyInfo || getDefaultCompanyInfo();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.companyInfo}>
            <Text style={styles.companyName}>{company.name}</Text>
            <Text style={styles.companyDetail}>{company.address}</Text>
            <Text style={styles.companyDetail}>{company.phone}</Text>
            <Text style={styles.companyDetail}>{company.email}</Text>
          </View>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>ĐƠN HÀNG</Text>
            <Text style={styles.orderNumber}>Số: {order.orderNumber}</Text>
            <Text style={styles.orderNumber}>
              Ngày: {pdfFormatDate(order.createdAt)}
            </Text>
            <Text style={styles.statusBadge}>
              {STATUS_LABELS[order.status] || order.status}
            </Text>
          </View>
        </View>

        {/* Order Info */}
        <Text style={styles.sectionTitle}>THÔNG TIN ĐƠN HÀNG</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoGrid}>
            {order.company && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Công ty</Text>
                <Text style={styles.infoValue}>{order.company.name}</Text>
              </View>
            )}
            {order.quote && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Báo giá tham chiếu</Text>
                <Text style={styles.infoValue}>{order.quote.quoteNumber}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Thanh toán</Text>
              <Text
                style={[
                  styles.infoValue,
                  { color: order.paidAt ? "#059669" : "#D97706" },
                ]}
              >
                {order.paidAt ? pdfFormatDate(order.paidAt) : "Chưa thanh toán"}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Giao hàng</Text>
              <Text style={styles.infoValue}>
                {order.shippedAt ? pdfFormatDate(order.shippedAt) : "Chưa giao"}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Nhận hàng</Text>
              <Text style={styles.infoValue}>
                {order.deliveredAt
                  ? pdfFormatDate(order.deliveredAt)
                  : "Chưa nhận"}
              </Text>
            </View>
            {order.shippingAddress && (
              <View style={[styles.infoItem, { width: "100%" }]}>
                <Text style={styles.infoLabel}>Địa chỉ giao hàng</Text>
                <Text style={styles.infoValue}>{order.shippingAddress}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Items Table */}
        <Text style={styles.sectionTitle}>CHI TIẾT ĐƠN HÀNG</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colNum]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.colProduct]}>
              Sản phẩm
            </Text>
            <Text style={[styles.tableHeaderText, styles.colQty]}>SL</Text>
            <Text style={[styles.tableHeaderText, styles.colPrice]}>
              Đơn giá
            </Text>
            <Text style={[styles.tableHeaderText, styles.colTotal]}>
              Thành tiền
            </Text>
          </View>

          {order.items.map((item, idx) => (
            <View
              key={idx}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCell, styles.colNum]}>{idx + 1}</Text>
              <View style={styles.colProduct}>
                <Text style={styles.tableCell}>
                  {item.product?.name || item.description || "Sản phẩm"}
                </Text>
                {item.product?.name && item.description && (
                  <Text
                    style={[
                      styles.tableCell,
                      { color: "#9CA3AF", fontSize: 8 },
                    ]}
                  >
                    {item.description}
                  </Text>
                )}
              </View>
              <Text style={[styles.tableCell, styles.colQty]}>
                {Number(item.quantity)}
              </Text>
              <Text style={[styles.tableCell, styles.colPrice]}>
                {pdfFormatCurrency(Number(item.unitPrice))}
              </Text>
              <Text
                style={[styles.tableCell, styles.colTotal, { fontWeight: 700 }]}
              >
                {pdfFormatCurrency(Number(item.total))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tạm tính</Text>
              <Text style={styles.totalValue}>
                {pdfFormatCurrency(order.subtotal)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Thuế VAT</Text>
              <Text style={styles.totalValue}>
                +{pdfFormatCurrency(order.taxAmount)}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>TỔNG CỘNG</Text>
              <Text style={styles.grandTotalValue}>
                {pdfFormatCurrency(order.total)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {order.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.sectionTitle}>GHI CHÚ</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Cờ vua Dương Sinh CRM</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `Trang ${pageNumber}/${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export default OrderPDF;
