import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }
    twilioClient = twilio(accountSid, authToken);
  }
  return twilioClient;
}

export async function sendSmsOtp(phone: string, code: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }

  const client = getClient();
  await client.messages.create({
    body: `Your Raksha verification code is: ${code}. It expires in 10 minutes.`,
    from,
    to: phone,
  });
}
