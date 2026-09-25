# studesafe
Studesafe is an app for student safety

## Docs

All architecture and requirements docs live in [`architecture/`](./architecture/):

- [`PROTOTYPE_ARCHITECTURE.md`](./architecture/PROTOTYPE_ARCHITECTURE.md)
  and [`PROTOTYPE_REQUIREMENTS.md`](./architecture/PROTOTYPE_REQUIREMENTS.md):
  what to build first. One school, 500–1,000 students, one small
  DigitalOcean server, about $7–8/month.
- [`ARCHITECTURE.md`](./architecture/ARCHITECTURE.md) and
  [`REQUIREMENTS.md`](./architecture/REQUIREMENTS.md): the full-scale
  production target for a multi-school rollout, Cloudflare-native
  (Workers, Durable Objects, D1, R2, Queues, Tunnel).

The landing page lives on the `website` branch.
