# Vue 3 + Vite

This template should help get you started developing with Vue 3 in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about IDE Support for Vue in the [Vue Docs Scaling up Guide](https://vuejs.org/guide/scaling-up/tooling.html#ide-support).

## Ask Claude about the church records

`/api/mcp` publishes the app's records as a Model Context Protocol connector,
so the calendar, the roll, attendance, schedules, minutes, tasks and the
ledger can be asked about in conversation. It is off until `MCP_TOKEN` is set.

See [MCP.md](MCP.md) for the tools it offers and how to connect Claude to it.

## Google sign-in on an installed iOS app

Signing in works everywhere out of the box **except** one case: the app
installed to an iPhone or iPad home screen. There, `signInWithPopup` cannot
work — iOS opens the popup outside the app, where it can never report back —
so the sign-in has to be a full-page redirect instead. Safari then partitions
storage per site, and a redirect that detours through
`church-c9b15.firebaseapp.com` comes back to a different site than it left,
with the sign-in state stranded on the other one.

The fix is to stop leaving this domain. `vercel.json` already proxies
`/__/auth/*` to Firebase, so its sign-in handler is served from our own domain,
and `VITE_FIREBASE_SELF_HOSTED_AUTH=true` points Firebase at it. That flag is
off by default because the proxy alone is not enough — turning it on before
the two console changes below are made would break Google sign-in on *every*
device rather than fix it on iOS.

To turn it on:

1. **Firebase console** → Authentication → Settings → Authorized domains: add
   the production domain, if it is not already listed.
2. **Google Cloud console** → APIs & Services → Credentials → the "Web client"
   OAuth 2.0 client ID → Authorised redirect URIs: add
   `https://<production-domain>/__/auth/handler`. Google refuses any redirect
   URI it has not been shown in advance, and this one is new.
3. Set `VITE_FIREBASE_SELF_HOSTED_AUTH=true` in the Vercel project's
   environment variables (and in `.env.local` to try it locally), then
   redeploy.

Verify on a real iPhone, not the simulator and not desktop Safari's responsive
mode: install to the home screen, open from there, and sign in with Google.
Preview deployments get a fresh domain each time and are not listed in either
console, so they will fail step 1 — test this on production.
