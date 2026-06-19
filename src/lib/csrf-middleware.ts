import { createMiddleware } from "@tanstack/react-start";

/**
 * Temporary CSRF middleware.
 *
 * TanStack Start expects createCsrfMiddleware() for server-fn endpoints.
 * This file exists only to keep imports/usage centralized.
 */
export const csrfRequestMiddleware = createMiddleware();
