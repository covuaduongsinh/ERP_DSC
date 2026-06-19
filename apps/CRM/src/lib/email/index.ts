import { Resend } from "resend";
import { render } from "@react-email/components";
import { prisma } from "@/lib/prisma";
import { WelcomeEmail, type WelcomeEmailProps } from "./templates/welcome";
import {
  QuoteSentEmail,
  type QuoteSentEmailProps,
} from "./templates/quote-sent";
import {
  QuoteExpiringEmail,
  type QuoteExpiringEmailProps,
} from "./templates/quote-expiring";
import {
  PortalMagicLinkEmail,
  type PortalMagicLinkEmailProps,
} from "./templates/portal-magic-link";
import {
  PasswordResetEmail,
  type PasswordResetEmailProps,
} from "./templates/password-reset";
import { CampaignEmail, type CampaignEmailProps } from "./templates/campaign";
import {
  NotificationQuoteAcceptedEmail,
  type NotificationQuoteAcceptedProps,
} from "./templates/notification-quote-accepted";
import {
  NotificationQuoteRejectedEmail,
  type NotificationQuoteRejectedProps,
} from "./templates/notification-quote-rejected";
import {
  NotificationTicketNewEmail,
  type NotificationTicketNewProps,
} from "./templates/notification-ticket-new";
import {
  NotificationTicketAssignedEmail,
  type NotificationTicketAssignedProps,
} from "./templates/notification-ticket-assigned";
import {
  NotificationOrderStatusEmail,
  type NotificationOrderStatusProps,
} from "./templates/notification-order-status";
import {
  NotificationQuoteExpiringNotifEmail,
  type NotificationQuoteExpiringNotifProps,
} from "./templates/notification-quote-expiring-notif";
import {
  NotificationCampaignSentEmail,
  type NotificationCampaignSentProps,
} from "./templates/notification-campaign-sent";
import * as React from "react";

// ── Types ────────────────────────────────────────────────────────────

export type EmailTemplate =
  | "welcome"
  | "quote-sent"
  | "quote-expiring"
  | "portal-magic-link"
  | "password-reset"
  | "campaign"
  | "notification-quote-accepted"
  | "notification-quote-rejected"
  | "notification-ticket-new"
  | "notification-ticket-assigned"
  | "notification-order-status"
  | "notification-quote-expiring"
  | "notification-campaign-sent";

export interface EmailOptions {
  to: string | string[];
  subject: string;
  template: EmailTemplate;
  data: Record<string, any>;
  attachments?: Array<{ filename: string; content: Buffer }>;
  replyTo?: string;
  from?: string;
  /** Pre-rendered HTML. If provided, skips template rendering. */
  html?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BulkEmailOptions {
  recipients: Array<{ to: string; data: Record<string, any> }>;
  subject: string;
  template: EmailTemplate;
  from?: string;
  replyTo?: string;
}

export interface BulkEmailResult {
  total: number;
  sent: number;
  failed: number;
  errors: Array<{ to: string; error: string }>;
}

// ── Template Rendering ───────────────────────────────────────────────

function getTemplateComponent(
  template: EmailTemplate,
  data: Record<string, any>,
): React.ReactElement {
  switch (template) {
    case "welcome":
      return React.createElement(WelcomeEmail, data as WelcomeEmailProps);
    case "quote-sent":
      return React.createElement(QuoteSentEmail, data as QuoteSentEmailProps);
    case "quote-expiring":
      return React.createElement(
        QuoteExpiringEmail,
        data as QuoteExpiringEmailProps,
      );
    case "portal-magic-link":
      return React.createElement(
        PortalMagicLinkEmail,
        data as PortalMagicLinkEmailProps,
      );
    case "password-reset":
      return React.createElement(
        PasswordResetEmail,
        data as PasswordResetEmailProps,
      );
    case "campaign":
      return React.createElement(CampaignEmail, data as CampaignEmailProps);
    case "notification-quote-accepted":
      return React.createElement(
        NotificationQuoteAcceptedEmail,
        data as NotificationQuoteAcceptedProps,
      );
    case "notification-quote-rejected":
      return React.createElement(
        NotificationQuoteRejectedEmail,
        data as NotificationQuoteRejectedProps,
      );
    case "notification-ticket-new":
      return React.createElement(
        NotificationTicketNewEmail,
        data as NotificationTicketNewProps,
      );
    case "notification-ticket-assigned":
      return React.createElement(
        NotificationTicketAssignedEmail,
        data as NotificationTicketAssignedProps,
      );
    case "notification-order-status":
      return React.createElement(
        NotificationOrderStatusEmail,
        data as NotificationOrderStatusProps,
      );
    case "notification-quote-expiring":
      return React.createElement(
        NotificationQuoteExpiringNotifEmail,
        data as NotificationQuoteExpiringNotifProps,
      );
    case "notification-campaign-sent":
      return React.createElement(
        NotificationCampaignSentEmail,
        data as NotificationCampaignSentProps,
      );
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

export async function renderTemplate(
  template: EmailTemplate,
  data: Record<string, any>,
): Promise<string> {
  const component = getTemplateComponent(template, data);
  return await render(component);
}

// ── Resend Client ────────────────────────────────────────────────────

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY environment variable is not set");
  }
  return new Resend(apiKey);
}

const DEFAULT_FROM =
  process.env.EMAIL_FROM || "Cờ vua Dương Sinh CRM <onboarding@resend.dev>";

// ── Send Single Email ────────────────────────────────────────────────

export async function sendEmail(
  options: EmailOptions,
  userId?: string,
): Promise<EmailResult> {
  const {
    to,
    subject,
    template,
    data,
    attachments,
    replyTo,
    from,
    html: preRenderedHtml,
  } = options;
  const toAddress = Array.isArray(to) ? to.join(", ") : to;

  try {
    const html = preRenderedHtml || (await renderTemplate(template, data));
    const resend = getResendClient();

    const payload: Parameters<typeof resend.emails.send>[0] = {
      from: from || DEFAULT_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo && { replyTo }),
      ...(attachments?.length && {
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      }),
    };

    let result: EmailResult;

    try {
      const response = await resend.emails.send(payload);

      if (response.error) {
        // Retry once
        const retryResponse = await resend.emails.send(payload);
        if (retryResponse.error) {
          result = {
            success: false,
            error:
              retryResponse.error.message || "Failed to send email after retry",
          };
        } else {
          result = {
            success: true,
            messageId: retryResponse.data?.id,
          };
        }
      } else {
        result = {
          success: true,
          messageId: response.data?.id,
        };
      }
    } catch (sendError: any) {
      // Retry once on exception
      try {
        const retryResponse = await resend.emails.send(payload);
        if (retryResponse.error) {
          result = {
            success: false,
            error: retryResponse.error.message || "Failed after retry",
          };
        } else {
          result = {
            success: true,
            messageId: retryResponse.data?.id,
          };
        }
      } catch (retryError: any) {
        result = {
          success: false,
          error: retryError.message || "Failed to send email",
        };
      }
    }

    // Log to database
    if (userId) {
      try {
        await prisma.emailLog.create({
          data: {
            to: toAddress,
            subject,
            template,
            status: result.success ? "SENT" : "FAILED",
            messageId: result.messageId || null,
            error: result.error || null,
            sentAt: result.success ? new Date() : null,
            userId,
          },
        });
      } catch (logError) {
        console.error("[Email] Failed to log email:", logError);
      }
    }

    if (!result.success) {
      console.error("[Email] Send failed:", {
        to: toAddress,
        template,
        error: result.error,
      });
    }

    return result;
  } catch (error: any) {
    const errorMessage = error.message || "Unknown email error";
    console.error("[Email] Error:", {
      to: toAddress,
      template,
      error: errorMessage,
    });

    // Log failure
    if (userId) {
      try {
        await prisma.emailLog.create({
          data: {
            to: toAddress,
            subject,
            template,
            status: "FAILED",
            error: errorMessage,
            userId,
          },
        });
      } catch (logError) {
        console.error("[Email] Failed to log email error:", logError);
      }
    }

    return { success: false, error: errorMessage };
  }
}

// ── Send Bulk Email ──────────────────────────────────────────────────

export async function sendBulkEmail(
  options: BulkEmailOptions,
  userId?: string,
): Promise<BulkEmailResult> {
  const { recipients, subject, template, from, replyTo } = options;
  const result: BulkEmailResult = {
    total: recipients.length,
    sent: 0,
    failed: 0,
    errors: [],
  };

  for (const recipient of recipients) {
    const emailResult = await sendEmail(
      {
        to: recipient.to,
        subject,
        template,
        data: recipient.data,
        from,
        replyTo,
      },
      userId,
    );

    if (emailResult.success) {
      result.sent++;
    } else {
      result.failed++;
      result.errors.push({
        to: recipient.to,
        error: emailResult.error || "Unknown error",
      });
    }
  }

  return result;
}
