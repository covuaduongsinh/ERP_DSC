import { Heading, Text, Section, Link, Hr } from "@react-email/components";
import * as React from "react";
import { BaseLayout } from "./base-layout";

export interface CampaignEmailProps {
  content: string;
  recipientName?: string;
  unsubscribeUrl: string;
}

export function CampaignEmail({
  content,
  recipientName,
  unsubscribeUrl,
}: CampaignEmailProps) {
  return (
    <BaseLayout preview="Thông tin từ Cờ vua Dương Sinh CRM">
      {recipientName && <Text style={greeting}>Xin chào {recipientName},</Text>}

      {/* Dynamic campaign content rendered as HTML */}
      <Section
        style={contentSection}
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <Hr style={hr} />

      <Text style={unsubscribeText}>
        Bạn nhận được email này vì bạn đã đăng ký nhận thông tin.{" "}
        <Link href={unsubscribeUrl} style={unsubscribeLink}>
          Hủy đăng ký
        </Link>
      </Text>
    </BaseLayout>
  );
}

const greeting: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const contentSection: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "24px",
};

const hr: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "24px 0 16px",
};

const unsubscribeText: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "11px",
  lineHeight: "16px",
  margin: 0,
};

const unsubscribeLink: React.CSSProperties = {
  color: "#6B7280",
  textDecoration: "underline",
};

export default CampaignEmail;
