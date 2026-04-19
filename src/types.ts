export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  dailyCalorieGoal: number;
  height?: number;
  weight?: number;
  age?: number;
  phoneNumber?: string;
  notifiedToday?: boolean;
  lastNotificationDate?: string;
  createdAt: string;
}

export interface MealLog {
  id?: string;
  userId: string;
  foodName: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: string;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
