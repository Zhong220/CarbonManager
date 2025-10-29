import type { AuthClient } from "./auth.contract";
import { authMock } from "./auth.mock";
import { authHttp } from "./auth.http";

export const USE_MOCK = true; // 之後接後端改 false

export const auth: AuthClient = USE_MOCK ? authMock : authHttp;
export * from "./auth.contract";
