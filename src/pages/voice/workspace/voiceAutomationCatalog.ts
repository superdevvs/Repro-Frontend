import type { VoiceAutomationTrigger } from '@/services/voiceAutomations';

export const automationTriggers: { key: VoiceAutomationTrigger; label: string; detail: string }[] = [
  { key: 'missed_call_callback', label: 'A call is missed', detail: 'When the voice routing service identifies a missed call.' },
  { key: 'failed_transfer_callback', label: 'A staff transfer fails', detail: 'When a handoff cannot connect to the team.' },
  { key: 'shoot_reminder', label: 'A shoot is due tomorrow', detail: 'Scheduled scans find shoots approximately one day ahead.' },
  { key: 'delivery_follow_up', label: 'Media has been delivered', detail: 'Scheduled scans find deliveries from one hour to two days ago.' },
  { key: 'unpaid_invoice_reminder', label: 'An unpaid invoice is due', detail: 'Scheduled scans find sent, unpaid invoices due tomorrow or earlier, including invoices without a due date.' },
];
