declare const __BUILD_ID__: string;

/**
 * Which build this is: written into the browser's code and the server's alike
 * as the app is built; see `vite.config.ts`. A page whose build differs from
 * the server's is running an old version.
 */
export const BUILD_ID = __BUILD_ID__;
