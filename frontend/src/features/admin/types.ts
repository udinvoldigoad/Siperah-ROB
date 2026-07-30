export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  institution: string | null;
  region_id: string | null;
  region_name: string | null;
  created_at: string | null;
  permission_workflow: {
    status: string;
    institution: string | null;
    reason: string | null;
    email_verified: boolean;
  } | null;
}

export interface UserMeta {
  current_page: number;
  last_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface UserSummary {
  total: number;
  aktif: number;
  menunggu: number;
  nonaktif: number;
  ditolak?: number;
  peneliti_menunggu: number;
}

export interface UserListResponse {
  data: UserData[];
  meta?: UserMeta;
  summary?: UserSummary;
}
