import { expect, type Page } from '@playwright/test';

/**
 * Admin credentials for the e2e run. Override via env so the spec does not hard-code
 * environment-specific secrets. Defaults match the seeded admin used by the backend
 * test/seed data.
 */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'password';

/**
 * Log in through the Dashboard login form (rendered at `/`).
 *
 * The login form uses placeholder-labelled inputs ("Email" / "Password") and a
 * "Log In" submit button, then navigates to `/dashboard` on success.
 */
export async function loginAsAdmin(
  page: Page,
  email: string = ADMIN_EMAIL,
  password: string = ADMIN_PASSWORD,
): Promise<void> {
  await login(page, email, password);
}

/**
 * Editor credentials for the e2e run, split by editing lane.
 *
 * NOTE — documented deviation from Requirement 7's glossary: this codebase does NOT model
 * distinct `video_editor` / `photo_editor` account *types*. There is a single `editor` role
 * (plus `editing_manager`) and lane specialization is carried on
 * `users.metadata.editing_capabilities` (an array containing `photo` and/or `video`). The two
 * credential sets below therefore refer to editor accounts whose `editing_capabilities` include
 * the photo lane and the video lane respectively — not to separate account types.
 *
 * Override via env so the spec does not hard-code environment-specific secrets. Defaults match
 * the naming convention used by the seeded QA accounts.
 */
export const PHOTO_EDITOR_EMAIL =
  process.env.E2E_PHOTO_EDITOR_EMAIL ?? 'photo-editor@example.com';
export const PHOTO_EDITOR_PASSWORD =
  process.env.E2E_PHOTO_EDITOR_PASSWORD ?? 'password';
export const VIDEO_EDITOR_EMAIL =
  process.env.E2E_VIDEO_EDITOR_EMAIL ?? 'video-editor@example.com';
export const VIDEO_EDITOR_PASSWORD =
  process.env.E2E_VIDEO_EDITOR_PASSWORD ?? 'password';

/**
 * Log in through the Dashboard login form as an editor (photo or video lane). The login form
 * is identical for every role — the differentiator is the seeded account's role + lane
 * capabilities — so this mirrors {@link loginAsAdmin} and simply forwards editor credentials.
 */
export async function loginAsEditor(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await login(page, email, password);
}

/**
 * Shared login routine used by every role helper. The login form (rendered at `/`) uses
 * placeholder-labelled inputs ("Email" / "Password") and a "Log In" submit button, then
 * navigates to `/dashboard` on success.
 */
async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');

  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Log In' }).click();

  // On success the app navigates to the dashboard (AC 7.1 — valid credentials authenticate).
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
}
