export interface Lead {
  id: string;
  email: string;
  source: string;
  referral_code: string | null;
  status: 'new' | 'confirmed' | 'converted';
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_user_id: string;
  code: string;
  clicks: number;
  signups: number;
  conversions: number;
  reward_status: 'none' | 'pending' | 'granted';
  created_at: string;
}

export interface ReferralEvent {
  id: string;
  code: string;
  event_type: 'click' | 'lead' | 'signup' | 'conversion';
  user_id: string | null;
  email: string | null;
  created_at: string;
}
