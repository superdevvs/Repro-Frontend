import type { Plugin } from 'vite';

export const reviewExpiresAt: string;
export const reviewedAdvisories: Record<string, string[]>;
export const reviewedPackages: Set<string>;
export const reviewedVersions: Record<string, string>;
export function assertReviewedLock(lock: { packages?: Record<string, { version?: string }> }, now?: number): void;
export function isReviewedAdvisory(packageName: string, advisoryId: string): boolean;
export function assertRuntimeSource(relativePath: string, source: string): void;
export function reviewedBuildGlobGuard(): Plugin;
