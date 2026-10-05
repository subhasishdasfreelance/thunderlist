declare const __BUILD_ID__: string;
declare const __BUILT_AT__: number;
declare const __IS_RELEASE__: boolean;

/**
 * Which build this is — on Vercel, the commit it was built from — written
 * into the browser's code and the server's alike as the app is built; see
 * `vite.config.ts`. A page whose build differs from the server's is running
 * an old version.
 */
export const BUILD_ID = __BUILD_ID__;

/** When this build was made, in milliseconds; see `announceRelease`. */
export const BUILT_AT = __BUILT_AT__;

/** Whether this build is a release: production, from `main`. */
export const IS_RELEASE = __IS_RELEASE__;
