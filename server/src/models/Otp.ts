import mongoose, { Schema, type Document } from 'mongoose';

export interface IOtp extends Document {
  phone: string;
  code: string;
  attempts: number;
  expiresAt: Date;
  createdAt: Date;
}

const otpSchema = new Schema<IOtp>({
  phone: { type: String, required: true, index: true },
  code: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Auto-delete expired OTPs
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = mongoose.model<IOtp>('Otp', otpSchema);
