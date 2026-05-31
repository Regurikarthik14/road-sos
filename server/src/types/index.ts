export interface UserProfile {
  uid: string;
  uniqueId: string;
  email: string;
  phone: string;
  displayName: string;
  medicalInfo: {
    bloodType: string;
    emergencyContact: string;
    allergies: string;
    medications: string;
  };
  createdAt: number;
  lastLoginAt: number;
}

export interface JwtPayload {
  uid: string;
  type: 'auth' | 'temp' | 'reset';
}
