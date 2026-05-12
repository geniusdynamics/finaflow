// ABOUTME: tRPC router for authenticated user queries and session management (logout).
// ABOUTME: The me endpoint returns the current user; logout clears the auth cookie.
import * as cookie from "cookie";
import { createRouter, authedQuery } from "./middleware";

export const authRouter = createRouter({
  me: authedQuery.query((opts) => opts.ctx.user),
  logout: authedQuery.mutation(async ({ ctx }) => {
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize("finaflow_token", "", {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
