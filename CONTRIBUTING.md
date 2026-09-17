# Contributing to AI Cancer Project

Thanks for wanting to help. This project is **source-available under a [PolyForm Noncommercial](LICENSE) license** — use and contributions are for noncommercial purposes. You do not need to be an ML engineer to contribute.

## Before you start

1. Read the [README](README.md) (live demo, setup, Docker).
2. Open an [issue](../../issues) for anything non-trivial so we can align before a big PR.
3. Keep PRs focused — one concern per PR when possible.

## Good first contributions

### Verify Docker self-host (high value)

The Compose stack is in the repo but **has not been fully smoke-tested by the maintainer yet**. A great first contribution:

1. Copy `.env.docker.example` → `.env.docker` and add Clerk + one AI key.
2. Run:
   ```bash
   docker compose --env-file .env.docker up --build
   ```
3. Confirm: migrate exits OK, http://localhost:3000 loads, you can sign in.
4. Open an issue or PR with: OS, Docker version, what worked, and any errors/logs (redact secrets).

Optional: try `--profile ml` and note build time / disk use.

### Other starter ideas

- Fix typos / clarify docs
- Add or improve a locale under `apps/web/src/messages/`
- Accessibility and UI polish — especially **responsive / mobile** layouts
- Path toward an **Expo / React Native app** reusing `packages/shared`
- Tests around auth scoping / **shared patients**
- Further mobile polish / Expo app

## Development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill keys
pnpm db:migrate
pnpm dev
```

Optional Sybil ML service: `cd apps/ml-service && ./setup.sh && ./start.sh`.

## Pull requests

- Describe **why**, not only what changed.
- Do not commit `.env`, `.env.local`, `.env.docker`, or real patient / upload data.
- Prefer small diffs; match existing code style.

## Security / medical data

Do not upload real identifiable patient data to issues, PRs, or the public demo beyond what you are comfortable sharing. The live demo uses synthetic / public sample data.

## License

By contributing, you agree your contributions are provided under the same [PolyForm Noncommercial License 1.0.0](LICENSE) as the project.
