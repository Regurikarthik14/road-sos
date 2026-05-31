export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function generateUniqueId(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100000 + Math.random() * 900000).toString();
  return timestamp + random;
}

export function generateResetToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 48 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}
