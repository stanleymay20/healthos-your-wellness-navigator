# Security Policy

## Scope

HealthOS is an engineering portfolio and preventive-wellness application, not a certified medical device or a substitute for professional diagnosis or treatment. Any deployment handling real health information requires an independent privacy, security, regulatory, and data-retention review appropriate to the jurisdiction and use case.

## Secret handling

Do not commit service-role keys, API keys, passwords, private certificates, or real `.env` files. Keep local configuration in ignored files and document only variable names with non-secret placeholders in `.env.example`.

If a real credential is ever committed, deletion alone is insufficient. Treat it as exposed, rotate or revoke it at the provider, update deployments, and assess repository history separately.

## Data access

User-facing health data must remain scoped through authenticated access and row-level security. Privileged server credentials must never be exposed to the browser. New tables or data flows must be reviewed for least privilege and explicit ownership rules.

## Reporting and verification

Report suspected security issues privately to the repository owner without including live credentials in issues. CI rejects tracked non-template environment files and runs linting, type checking, and a production build. Passing CI is evidence for those checks only and is not a medical, privacy, or security certification.
