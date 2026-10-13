// Mirrors the backend DTOs. Fields that can be null are optional (backend omits nulls).

export type Role = 'OWNER' | 'DOCTOR' | 'RECEPTIONIST';
export type AppointmentStatus = 'CONFIRMED' | 'WAITING' | 'IN_CONSULT' | 'SEEN' | 'NO_SHOW' | 'CANCELLED';
export type BookedBy = 'SILETRY' | 'FRONT_DESK' | 'WALK_IN';
export type ConversationState = 'BOT' | 'NEEDS_YOU' | 'YOU_REPLIED' | 'HANDLED';
export type Day = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface User { id: number; name: string; email: string; phone?: string; role: Role; doctorId?: number; active: boolean }
export interface ClinicSummary { id: number; name: string; area?: string; whatsappNumber?: string; whatsappConnected: boolean; botEnabled: boolean; plan: string; live: boolean; onboardingStep: number }
export interface AuthResponse { token?: string; user: User; clinic: ClinicSummary }

export interface ConversationRow {
  id: number; patientId: number; name?: string; initials?: string; phone?: string; preview?: string;
  lastMessageAt?: string; state: ConversationState; emergency: boolean; unreadCount: number;
  handoffReason?: string; language?: string; takenOver: boolean;
}

export interface Overview {
  from: string; to: string;
  messagesAnswered: { value: number; changePercent?: number };
  appointmentsBooked: { value: number; changePercent?: number; percentWithoutStaff: number };
  revenueBooked: { value: number; changeVsPrevious: number };
  noShows: { ratePercent?: number; previousRatePercent?: number; changePercent?: number; noShows: number };
  bookingsPerDay: { date: string; label: string; siletry: number; staff: number }[];
  needsHuman: ConversationRow[];
  needsHumanCount: number;
  languages: { language: string; conversations: number; percent: number }[];
}

export interface AppointmentRow {
  id: number; startAt: string; endAt: string; time: string;
  patientId: number; patientName?: string; patientPhone?: string;
  reason?: string; doctorId: number; doctorName?: string;
  bookedBy: BookedBy; status: AppointmentStatus; emergency: boolean;
  tokenNumber?: number; frontDeskNote?: string; source?: string; conversationId?: number; reminderResponse?: string;
}
export interface AppointmentList {
  dateLabel: string;
  counts: { today: number; thisWeek: number; noShows: number; cancelled: number };
  items: AppointmentRow[];
}

export interface QueueEntry {
  appointmentId: number; tokenNumber?: number; patientId: number; patientName?: string; phone?: string;
  reason?: string; status: AppointmentStatus; emergency: boolean; bookedBy: BookedBy;
  scheduledAt?: string; checkedInAt?: string; position: number; etaMinutes: number; waitedMinutes: number;
}
export interface QueueView {
  doctorId: number; doctorName: string; current?: QueueEntry; waiting: QueueEntry[];
  avgConsultMinutes: number; stale: boolean; lastCalledAt?: string; seenToday: number;
}

export interface Session { day: Day; start: string; end: string }
export interface BookingRules { minNoticeMinutes: number; maxAdvanceDays: number; maxBotBookingsPerDay?: number | null; bookableOnWhatsapp: boolean }
export interface Doctor {
  id: number; name: string; shortName: string; initials: string; speciality?: string; registrationNo?: string;
  fee: number; alertMobile?: string; slotMinutes: number; languages: string[]; active: boolean;
  todayStatus: 'IN_CLINIC' | 'ON_LEAVE' | 'OFF_TODAY'; slotsThisWeek: number; upcomingLeaveCount: number;
  bookingRules: BookingRules; sessions: Session[];
}
export interface Leave { id?: number; startAt: string; endAt: string; reason?: string }
export interface Slot { startAt: string; label: string; state: 'FREE' | 'HELD' | 'BOOKED' | 'BLOCKED' }
export interface DaySummary { date: string; label: string; free: number; closed: boolean }
export interface HoursUpdateResult {
  doctor: Doctor;
  needToMove: { appointmentId: number; startAt: string; patientName: string; patientPhone: string }[];
}

export interface PatientRow {
  id: number; name: string; initials: string; phone: string; patientNo: number; age?: number; gender?: string;
  language?: string; lastVisitAt?: string; nextAppointmentAt?: string; visits: number; dueFollowUp?: string;
}
export interface PageResult<T> { items: T[]; page: number; size: number; total: number }
export interface PatientProfile {
  id: number; name: string; initials: string; age?: number; gender?: string; phone: string; patientNo: number;
  language?: string; dueFollowUp?: string; conversationId?: number;
  nextAppointment?: {
    appointmentId: number; startAt: string; doctorId: number; doctorName?: string; reason?: string;
    status: AppointmentStatus; bookedBy: BookedBy; bookedAt: string;
  };
  stats: { visits: number; noShows: number; bookedBySiletry: number; patientSince: string };
  details: {
    whatsappOptIn: boolean; optInAt?: string; optedOut: boolean; preferredLanguage?: string;
    preferredDoctorId?: number; preferredDoctorName?: string; usualTime?: string;
    emergencyContactName?: string; emergencyContactPhone?: string; notes?: string;
  };
  followUps: { id: number; title: string; dueDate: string; status: string; dueLabel?: string }[];
  visits: { appointmentId: number; startAt: string; reason?: string; doctorId: number; doctorName?: string; bookedBy: BookedBy; status: AppointmentStatus }[];
}

export interface MessageView {
  id: number; direction: 'IN' | 'OUT'; sender: 'PATIENT' | 'SILETRY' | 'STAFF' | 'SYSTEM'; body?: string;
  buttons: string[]; kind: 'TEXT' | 'BUTTONS' | 'TEMPLATE'; status: string; error?: string;
  createdAt: string; sentByName?: string; templateName?: string;
}
export interface InboxList { needsYou: number; all: number; items: ConversationRow[] }
export interface ChatThread {
  conversation: ConversationRow; windowOpen: boolean; windowClosesAt?: string;
  takenOverByName?: string; botStep?: string; messages: MessageView[];
}

export interface QrView {
  id: number; code: string; type: 'BOOKING' | 'CHECKIN'; label: string; doctorId?: number; scans: number;
  active: boolean; prefilledText: string; waLink?: string;
}
export interface TemplateView {
  id: number; name: string; category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'; language: string; body: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'; rejectionReason?: string;
}
export interface ClinicView {
  id: number; name: string; area?: string; city?: string; address?: string; phone?: string;
  whatsappNumber?: string; whatsappConnected: boolean; botEnabled: boolean; plan: string; trialEndsAt?: string;
  messageCap: number; remindersEnabled: boolean; reminderTime: string; followupsEnabled: boolean;
  queueUpdatesEnabled: boolean; googleReviewLink?: string;
  delayAnnouncementsEnabled: boolean; googleReviewsEnabled: boolean;
  clinicType?: string; landmark?: string; replyLanguages: string[]; live: boolean;
  apiConnected: boolean; verifiedName?: string; phoneNumberId?: string; businessAccountId?: string; apiConnectedAt?: string;
}
export interface UsageView { month: string; businessInitiated: number; cap: number; serviceReplies: number; inbound: number; percentUsed: number }
export interface FollowUpView { id: number; patientId: number; doctorId?: number; title: string; dueDate: string; status: string; appointmentId?: number }
export interface SimResult { conversationId?: number; replies: MessageView[] }

export interface OtpTicket { ticket: string; maskedPhone: string; expiresInSeconds: number; resendInSeconds: number; devCode?: string }

export interface Block { start: string; end: string }
export interface SetupDoctor { id?: number; name: string; speciality?: string; fee?: number; slotMinutes?: number }
export interface SetupState {
  step: number; live: boolean;
  name: string; clinicType?: string; city?: string; address?: string; landmark?: string; languages: string[];
  doctorCountHint?: number;
  doctors: SetupDoctor[]; days: Day[]; morning?: Block; evening?: Block;
  whatsappNumber?: string; whatsappConnected: boolean; whatsappNumberChoice?: string; testMode: boolean;
  apiConnected: boolean; verifiedName?: string; phoneNumberId?: string;
  reminders: boolean; followups: boolean; delayAnnouncements: boolean; googleReviews: boolean; queueUpdates: boolean;
  ownerPhone?: string;
}

export interface ConnectResult { displayNumber?: string; verifiedName?: string; qualityRating?: string; templatesSubmitted: number; warnings: string[] }
export interface TemplateSync { submitted: number; approved: number; pending: number; rejected: number; errors: string[] }
