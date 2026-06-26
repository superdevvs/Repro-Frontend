/**
 * Run-id data factory for the photographer onboarding QA harness.
 *
 * Produces identifiable QA data by appending the `E2E_QA_RUN_ID` suffix to every generated
 * name, email, and address so that every `QA_Entity` created during a run is uniquely tagged
 * and can be selected for run-scoped cleanup (Requirements 1.7, 21.1; applied transitively by
 * 5.1/5.2, 19.1).
 *
 * Suffix shapes:
 * - name:    `${base} ${runId}`              (space-delimited token)
 * - address: `${base} ${runId}`              (space-delimited token)
 * - email:   `${base}.${runId}@example.test` (suffix inserted into the local part so the
 *            address keeps a valid `local@domain` shape — e.g. `client.qa` becomes
 *            `client.qa.{RUN_ID}@example.test`)
 */

/** Domain used for all QA-generated email addresses (a reserved, non-deliverable TLD). */
const EMAIL_DOMAIN = 'example.test';

export interface DataFactory {
  /** `${base} ${runId}` — a display name carrying this run's suffix. */
  name(base: string): string;
  /** `${base}.${runId}@example.test` — a valid email with the suffix in the local part. */
  email(base: string): string;
  /** `${base} ${runId}` — an address carrying this run's suffix. */
  address(base: string): string;
  /** True iff the value carries this run's suffix (used by cleanup selection, Req 21.1). */
  belongsToRun(value: string): boolean;
}

/**
 * Create a {@link DataFactory} bound to a single run id.
 *
 * The same `runId` is used both to generate suffixed values and to recognize them again via
 * {@link DataFactory.belongsToRun}, so generation and detection stay in lockstep:
 * `belongsToRun(name(base))`, `belongsToRun(email(base))`, and `belongsToRun(address(base))`
 * are all true, while values carrying a different run id are not matched.
 */
export function createDataFactory(runId: string): DataFactory {
  const spaceSuffix = ` ${runId}`;
  const emailLocalSuffix = `.${runId}`;

  return {
    name(base: string): string {
      return `${base}${spaceSuffix}`;
    },

    email(base: string): string {
      return `${base}${emailLocalSuffix}@${EMAIL_DOMAIN}`;
    },

    address(base: string): string {
      return `${base}${spaceSuffix}`;
    },

    belongsToRun(value: string): boolean {
      // An empty run id cannot reliably tag (or be detected in) a value.
      if (runId.length === 0) {
        return false;
      }

      // Email-shaped values carry the suffix in the local part: `<local>.<runId>@<domain>`.
      const atIndex = value.indexOf('@');
      if (atIndex !== -1) {
        const localPart = value.slice(0, atIndex);
        return localPart.endsWith(emailLocalSuffix);
      }

      // Names and addresses carry the suffix as a trailing space-delimited token.
      return value.endsWith(spaceSuffix);
    },
  };
}
