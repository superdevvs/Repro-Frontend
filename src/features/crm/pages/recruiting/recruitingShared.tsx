import type { Person } from '../../types';
import type { Tone } from '../../ui/primitives';

export interface RecruitMeta {
  stages: { key: string; label: string }[];
  roles: { key: 'photographer' | 'sales_rep'; label: string }[];
  sources: string[];
  specialties: string[];
  score_keys: string[];
  file_kinds: string[];
  states: Record<string, string>;
  can: { manage: boolean; documents: boolean };
}

export interface ApplicantCard {
  id: number; name: string; role: 'photographer' | 'sales_rep'; stage: string; stage_label: string; city: string | null; state: string | null; states: string[];
  source: string; specialty: string | null; flies_drone: boolean; score: number | null; posting: { id: number; title: string } | null; days_in_stage: number | null;
  exit_reason: string | null; created_at: string | null;
}

export interface Applicant extends ApplicantCard {
  email: string | null; phone: string | null; metros: string | null; travel_radius: number | null; portfolio_url: string | null; gear: string[];
  part107_number: string | null; part107_expiry: string | null; insurance_expiry: string | null; sales_experience: string | null; scores: Record<string, number>;
  stage_before_exit: string | null; hired_user: Person | null;
  roster: { user: Person | null; role: string; states: string[]; part107_expiry: string | null; insurance_expiry: string | null; part107_expiring: boolean; insurance_expiring: boolean; active: boolean } | null;
  files: { id: number; kind: string; name: string; mime: string | null; size: number; url: string; uploaded_by: Person | null; created_at: string | null }[] | null;
  file_count: number;
  stages: { from: string | null; to: string; reason: string | null; by: Person | null; at: string }[];
  notes: { id: number; kind: string; body: string; scores: Record<string, number> | null; author: Person | null; created_at: string }[];
  events: import('../../types').CrmEvent[];
  emails: { id: number; subject: string; status: string; from: string; sent_at: string | null; created_at: string | null }[];
}

export const ROLE_LABEL: Record<string, string> = { photographer: 'Photographer', sales_rep: 'Sales rep' };
export const SOURCE_LABEL: Record<string, string> = { job_board: 'Job board', referral: 'Referral', social: 'Social', website: 'Website', other: 'Other' };
export const SCORE_LABEL: Record<string, string> = { quality: 'Work quality', communication: 'Communication', reliability: 'Reliability', fit: 'Fit' };
export const FILE_LABEL: Record<string, string> = { resume: 'Résumé', portfolio_sample: 'Portfolio sample', license: 'Licence', insurance: 'Insurance', application: 'Application', other: 'Other' };

export const stageTone = (stage: string): Tone =>
  stage === 'hired' ? 'green' : stage === 'not_moving_forward' ? 'red' : stage === 'offer' ? 'violet' : stage === 'trial' ? 'amber' : stage === 'interview' ? 'blue' : 'line';
