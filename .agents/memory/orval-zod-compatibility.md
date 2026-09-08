---
name: Orval and Zod compatibility
description: Generated Zod schemas must match the workspace's installed major version.
---

The workspace's generated API schemas must stay compatible with the installed Zod runtime; newer Orval output can emit helpers unavailable in the workspace's Zod major.

**Why:** API code generation initially produced a helper that the installed Zod version did not expose, blocking library typechecks.

**How to apply:** After changing the OpenAPI contract, run codegen and the library typecheck before restarting services; if generated helpers are unsupported, prefer schema shapes that avoid them or align the dependency intentionally.