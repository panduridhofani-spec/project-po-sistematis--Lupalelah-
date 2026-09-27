export type UserRole = 'MASTER_ADMIN' | 'LEADER_BARISTA' | 'LOGISTICS';

export interface UserProfile {
  id: string;
  email?: string;
  full_name: string;
  role: UserRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}
