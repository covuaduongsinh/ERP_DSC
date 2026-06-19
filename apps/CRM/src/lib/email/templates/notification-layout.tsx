import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface NotificationLayoutProps {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
  settingsUrl?: string;
}

/**
 * Shared layout for CRM notification emails.
 * Includes unsubscribe link and settings link in footer.
 */
export function NotificationLayout({
  preview,
  children,
  unsubscribeUrl,
  settingsUrl,
}: NotificationLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Heading style={logo}>Cờ vua Dương Sinh CRM</Heading>
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Bạn nhận email này vì đã bật thông báo email trong Cờ vua Dương
              Sinh CRM.
            </Text>
            <Text style={footerLinks}>
              {settingsUrl && (
                <>
                  <Link href={settingsUrl} style={footerLink}>
                    Quản lý thông báo
                  </Link>
                  {unsubscribeUrl && " | "}
                </>
              )}
              {unsubscribeUrl && (
                <Link href={unsubscribeUrl} style={footerLink}>
                  Hủy đăng ký
                </Link>
              )}
            </Text>
            <Text style={footerCopy}>
              &copy; {new Date().getFullYear()} Cờ vua Dương Sinh CRM. All
              rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container: React.CSSProperties = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "580px",
};

const header: React.CSSProperties = {
  padding: "24px 32px",
};

const logo: React.CSSProperties = {
  color: "#2563EB",
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
};

const content: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  borderRadius: "8px",
  border: "1px solid #E5E7EB",
  padding: "32px",
};

const hr: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  padding: "0 32px",
};

const footerText: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "0 0 8px",
};

const footerLinks: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "16px",
  margin: "0 0 4px",
};

const footerCopy: React.CSSProperties = {
  color: "#D1D5DB",
  fontSize: "11px",
  lineHeight: "16px",
  margin: "8px 0 0",
};

const footerLink: React.CSSProperties = {
  color: "#6B7280",
  textDecoration: "underline",
};
