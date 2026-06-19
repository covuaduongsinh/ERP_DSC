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

interface BaseLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function BaseLayout({ preview, children }: BaseLayoutProps) {
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
              &copy; {new Date().getFullYear()} Cờ vua Dương Sinh CRM. All
              rights reserved.
            </Text>
            <Text style={footerLinks}>
              <Link href="#" style={footerLink}>
                Unsubscribe
              </Link>
              {" | "}
              <Link href="#" style={footerLink}>
                Privacy Policy
              </Link>
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

const logoIcon: React.CSSProperties = {
  color: "#10B981",
  marginRight: "6px",
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
  lineHeight: "16px",
  margin: "0 0 4px",
};

const footerLinks: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "16px",
  margin: 0,
};

const footerLink: React.CSSProperties = {
  color: "#6B7280",
  textDecoration: "underline",
};
