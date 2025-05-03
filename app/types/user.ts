// Types related to User Profile and Subscription

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_fee: string;
  premium_calls_quota: number;
  overage_rate: string;
  context_window: number;
  team_support: boolean;
  description: string;
}

export interface UserSubscription {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  start_date: string; // ISO 8601 date string
  end_date: string | null; // ISO 8601 date string or null
  next_billing_date: string | null; // ISO 8601 date string or null
  trial_expiration_date: string | null; // ISO 8601 date string or null
}

export interface UserProfile {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string; // ISO 8601 date string
  subscription: UserSubscription | null;
}
