/**
 * Single source of truth for the app version.
 *
 * The numbers are STAMPED AT BUILD TIME from git (see vite.config.ts), so they
 * can never drift the way the old hand-typed badges did — the header said
 * v1.1, the sidebar said v1.2 and About said v1.1.0, all in the same build.
 *
 * Scheme:  Alpha <build>.<month>.<revision>
 *   build     total commits on the branch — how many times this app has been built
 *   month     calendar month of the build (1-12)
 *   revision  commits made on the build date, so same-day rebuilds increment
 *
 * Nothing here is decorative: every digit is derived from the repository.
 */

declare const __BUILD_NUMBER__: number;
declare const __BUILD_MONTH__: number;
declare const __BUILD_REVISION__: number;
declare const __BUILD_DATE__: string;

const num = (v: unknown, fallback: number) => (typeof v === 'number' && !isNaN(v) ? v : fallback);

export const BUILD_NUMBER = num(typeof __BUILD_NUMBER__ !== 'undefined' ? __BUILD_NUMBER__ : undefined, 0);
export const BUILD_MONTH = num(typeof __BUILD_MONTH__ !== 'undefined' ? __BUILD_MONTH__ : undefined, new Date().getMonth() + 1);
export const BUILD_REVISION = num(typeof __BUILD_REVISION__ !== 'undefined' ? __BUILD_REVISION__ : undefined, 0);
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '';

/** Release stage. Flip to 'Beta' / '' when the app graduates. */
export const RELEASE_STAGE = 'Alpha';

/** e.g. "20.8.1" */
export const VERSION_NUMBER = `${BUILD_NUMBER}.${BUILD_MONTH}.${BUILD_REVISION}`;

/** Short badge text, e.g. "ALPHA 20.8.1" */
export const VERSION_BADGE = `${RELEASE_STAGE.toUpperCase()} ${VERSION_NUMBER}`;

/** Full label, e.g. "Alpha 20.8.1" */
export const APP_VERSION = `${RELEASE_STAGE} ${VERSION_NUMBER}`;

/** For About / diagnostics, e.g. "Alpha 20.8.1 · built 2026-08-27" */
export const APP_VERSION_LONG = BUILD_DATE ? `${APP_VERSION} · built ${BUILD_DATE}` : APP_VERSION;
