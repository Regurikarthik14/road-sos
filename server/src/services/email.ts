import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

export async function sendResetEmail(email: string, resetLink: string): Promise<void> {
  const client = getClient();
  await client.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your Raksha password',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">🛡️</span>
          <h1 style="font-size: 20px; color: #111827; margin: 8px 0 0;">Raksha</h1>
        </div>
        <p style="font-size: 16px; color: #374151; line-height: 1.5;">
          We received a request to reset your password. Click the button below to set a new one.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}"
             style="display: inline-block; padding: 14px 32px; border-radius: 12px;
                    background: linear-gradient(135deg, #EF4444 0%, #dc2626 100%);
                    color: #fff; text-decoration: none; font-size: 15px; font-weight: 700;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #6B7280;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendEmailOtp(email: string, code: string): Promise<void> {
  const client = getClient();
  await client.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Your Raksha verification code',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 48px;">🛡️</span>
          <h1 style="font-size: 20px; color: #111827; margin: 8px 0 0;">Raksha</h1>
        </div>
        <p style="font-size: 16px; color: #374151;">
          Your verification code is:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px;
                     color: #EF4444; font-family: monospace;">
            ${code}
          </span>
        </div>
        <p style="font-size: 14px; color: #6B7280;">
          This code expires in 10 minutes.
        </p>
      </div>
    `,
  });
}
