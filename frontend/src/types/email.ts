
export type EmailStatus =
  | "SCHEDULED"
  | "PROCESSING"
  | "SENT"
  | "FAILED";

export interface EmailSender {
  id: string;
  email: string;
  displayName: string | null;
}

export interface Email {
  id: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  failedAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sender: EmailSender;
}

export interface EmailListResponse {
  success: boolean;
  emails: Email[];
}


export interface SearchEmail {
  id: string;
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  status: EmailStatus;
  senderId: string;
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
}

export interface EmailSearchResponse {
  success: boolean;
  data: SearchEmail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


export interface ScheduleEmailPayload {
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
}

export interface EmailDashboardResponse {
  success: boolean;
  data: Email[];
  stats: {
    total: number;
    scheduled: number;
    processing: number;
    sent: number;
    failed: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
