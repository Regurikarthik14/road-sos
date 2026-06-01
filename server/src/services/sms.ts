import twilio from 'twilio';

let twilioClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
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
  const vonageKey = process.env.VONAGE_API_KEY;
  const vonageSecret = process.env.VONAGE_API_SECRET;

  if (vonageKey && vonageSecret) {
    // Send via Vonage SMS REST API using native fetch
    const fromName = process.env.VONAGE_BRAND_NAME || 'Raksha';
    const bodyText = `Your Raksha verification code is: ${code}. It expires in 10 minutes.`;

    const res = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: vonageKey,
        api_secret: vonageSecret,
        to: phone,
        from: fromName,
        text: bodyText,
      }),
    });

    const data = await res.json() as any;
    if (data.messages && data.messages[0] && data.messages[0].status !== '0') {
      throw new Error(`Vonage SMS failed: ${data.messages[0]['error-text'] || 'Unknown error'}`);
    }
    return;
  }

  // Fallback to Twilio
  const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (accountSid && authToken && twilioFrom) {
    const client = getTwilioClient();
    await client.messages.create({
      body: `Your Raksha verification code is: ${code}. It expires in 10 minutes.`,
      from: twilioFrom,
      to: phone,
    });
    return;
  }

  throw new Error('SMS provider not configured. Please set Twilio or Vonage credentials in .env.');
}

export async function sendTwilioVerify(phone: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio Verify credentials not configured (Check TWILIO_VERIFY_SERVICE_SID in .env)');
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: phone,
      Channel: 'sms',
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.message || 'Twilio Verify send failed');
  }
}

export async function checkTwilioVerify(phone: string, code: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) {
    throw new Error('Twilio Verify credentials not configured (Check TWILIO_VERIFY_SERVICE_SID in .env)');
  }

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/VerificationCheck`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: phone,
      Code: code,
    }),
  });

  const data = await res.json() as any;
  if (!res.ok) {
    throw new Error(data.message || 'Twilio Verify check failed');
  }
  return data.status === 'approved';
}
