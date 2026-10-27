/**
 * Transactional email dispatch via the Brevo SMTP REST API.
 * https://api.brevo.com/v3/smtp/email
 */

const BREVO_SMTP_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_DEV_PROXY_URL = '/api/brevo/smtp/email';

export interface ComplaintStatusEmailPayload {
  recipientEmail: string;
  recipientName?: string | null;
  complaintNumber: string;
  complaintTitle?: string | null;
  status: string;
  remarks: string;
  officerName?: string | null;
  officerDesignation?: string | null;
  dispatchType?: string | null;
  referenceNumber?: string | null;
  institutionName?: string | null;
}

export interface EmailDispatchResult {
  sent: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
}

function readEnv(value: unknown): string | null {
  const key = typeof value === 'string' ? value.trim() : '';
  return key && key !== 'undefined' ? key : null;
}

export function getBrevoApiKey(): string | null {
  return readEnv(import.meta.env.VITE_BREVO_API_KEY);
}

export function getBrevoSenderEmail(): string | null {
  return readEnv(import.meta.env.VITE_BREVO_SENDER_EMAIL);
}

export function isBrevoConfigured(): boolean {
  return Boolean(getBrevoApiKey() && getBrevoSenderEmail());
}

export function isValidEmail(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlBody(payload: ComplaintStatusEmailPayload): string {
  const name = escapeHtml(payload.recipientName?.trim() || 'Complainant');
  const remarks = escapeHtml(payload.remarks.trim() || 'No additional remarks were recorded.');
  const status = escapeHtml(payload.status);
  const complaintNumber = escapeHtml(payload.complaintNumber);
  const title = escapeHtml(payload.complaintTitle?.trim() || 'AICTE grievance');
  const officer = escapeHtml(
    [payload.officerName?.trim(), payload.officerDesignation?.trim() ? `(${payload.officerDesignation.trim()})` : '']
      .filter(Boolean)
      .join(' ') || 'AICTE Desk Officer'
  );
  const dispatchType = payload.dispatchType ? escapeHtml(payload.dispatchType) : null;
  const referenceNumber = payload.referenceNumber ? escapeHtml(payload.referenceNumber) : null;
  const institutionName = payload.institutionName ? escapeHtml(payload.institutionName) : null;
  const issuedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #cbd5e1;">
            <tr>
              <td style="background:#0b3b60;color:#ffffff;padding:18px 24px;">
                <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">All India Council for Technical Education</div>
                <div style="font-size:20px;font-weight:700;margin-top:4px;">Grievance Status Update</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 12px;font-size:14px;line-height:1.55;">Dear ${name},</p>
                <p style="margin:0 0 18px;font-size:14px;line-height:1.55;">
                  An official update has been recorded against your grievance. Please review the current status and the administrator remarks below.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;line-height:1.5;">
                  <tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;width:180px;font-weight:700;">Complaint Number</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${complaintNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Subject</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${title}</td>
                  </tr>
                  ${
                    institutionName
                      ? `<tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Institution</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${institutionName}</td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Updated Status</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;"><strong>${status}</strong></td>
                  </tr>
                  ${
                    dispatchType
                      ? `<tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Communication Type</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${dispatchType}</td>
                  </tr>`
                      : ''
                  }
                  ${
                    referenceNumber
                      ? `<tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Official Reference</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${referenceNumber}</td>
                  </tr>`
                      : ''
                  }
                  <tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Issued By</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${officer}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">Issued At</td>
                    <td style="padding:8px 10px;border:1px solid #e2e8f0;">${escapeHtml(issuedAt)}</td>
                  </tr>
                </table>
                <h3 style="margin:22px 0 8px;font-size:14px;color:#0b3b60;">Administrator Remarks</h3>
                <div style="padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;font-size:13px;line-height:1.6;white-space:pre-wrap;">${remarks}</div>
                <p style="margin:18px 0 0;font-size:12px;color:#475569;line-height:1.55;">
                  This is an automated transactional notification from the AICTE grievance redressal system. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function postToBrevo(apiKey: string, body: Record<string, unknown>): Promise<Response> {
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    'api-key': apiKey,
  };
  const payload = JSON.stringify(body);

  try {
    const direct = await fetch(BREVO_SMTP_EMAIL_URL, {
      method: 'POST',
      headers,
      body: payload,
    });
    return direct;
  } catch (directError) {
    // Browser CORS often blocks the public Brevo host; the Vite proxy forwards the same REST call.
    if (import.meta.env.DEV) {
      console.warn('Direct Brevo request failed, retrying through local proxy:', directError);
      return fetch(BREVO_DEV_PROXY_URL, {
        method: 'POST',
        headers,
        body: payload,
      });
    }
    throw directError;
  }
}

export async function sendComplaintStatusEmail(
  payload: ComplaintStatusEmailPayload
): Promise<EmailDispatchResult> {
  const recipientEmail = payload.recipientEmail?.trim().toLowerCase();
  if (!isValidEmail(recipientEmail)) {
    return {
      sent: false,
      skipped: true,
      error: 'No valid complainant email address is on the complaint record.',
    };
  }

  const apiKey = getBrevoApiKey();
  const senderEmail = getBrevoSenderEmail();
  if (!apiKey || !senderEmail) {
    return {
      sent: false,
      skipped: true,
      error: 'Brevo credentials are missing. Set VITE_BREVO_API_KEY and VITE_BREVO_SENDER_EMAIL in .env.',
    };
  }

  const recipientName = payload.recipientName?.trim() || 'Complainant';
  const subject = `AICTE Grievance Update: ${payload.complaintNumber} — Status ${payload.status}`;

  try {
    const response = await postToBrevo(apiKey, {
      sender: {
        email: senderEmail,
        name: 'AICTE Grievance Cell',
      },
      to: [{ email: recipientEmail, name: recipientName }],
      subject,
      htmlContent: buildHtmlBody(payload),
    });

    const raw = await response.text();
    let parsed: { messageId?: string; message?: string } = {};
    if (raw) {
      try {
        parsed = JSON.parse(raw) as { messageId?: string; message?: string };
      } catch {
        parsed = { message: raw };
      }
    }

    if (!response.ok) {
      return {
        sent: false,
        error: parsed.message || `Brevo rejected the email (HTTP ${response.status}).`,
      };
    }

    return {
      sent: true,
      messageId: parsed.messageId,
    };
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Brevo email dispatch failed:', err);
    return {
      sent: false,
      error: error?.message || 'Unable to reach the Brevo email API.',
    };
  }
}
