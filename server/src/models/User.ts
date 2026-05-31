import mongoose, { Schema, type Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  phone: string;
  password: string;
  uniqueId: string;
  displayName: string;
  medicalInfo: {
    bloodType: string;
    emergencyContact: string;
    allergies: string;
    medications: string;
  };
  resetToken?: string;
  resetTokenExpires?: Date;
  createdAt: Date;
  lastLoginAt: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  uniqueId: { type: String, required: true, unique: true },
  displayName: { type: String, default: '' },
  medicalInfo: {
    bloodType: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    allergies: { type: String, default: '' },
    medications: { type: String, default: '' },
  },
  resetToken: { type: String },
  resetTokenExpires: { type: Date },
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now },
});

export const User = mongoose.model<IUser>('User', userSchema);
