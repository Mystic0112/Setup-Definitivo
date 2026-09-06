---
name: docker_laradock
description: Security testing playbook for Docker and Laradock development/deploy stacks covering exposed services, container escape surface, secrets in images/compose, and misconfigured volumes
---

# Docker / Laradock

Security testing for Docker and Laradock (docker-compose-based PHP/Laravel stack). Focus: services bound to public interfaces, secrets baked into images or committed compose/env, over-privileged containers, and dev configs reaching production.

## Attack Surface

**Compose topology (Laradock)**
- `docker-compose.yml` service list: `nginx`, `php-fpm`, `workspace`, `mysql`/`mariadb`/`postgres`, `redis`, `mailhog`, `adminer`/`pma` (phpMyAdmin), `elasticsearch`, `minio`
- Port mappings (`ports:` — host-exposed) vs `expose:` (internal only)
- `.env` (Laradock root) and app `.env` mounted into containers

**Image & build**
- `Dockerfile` layers, base image tags (`:latest`, unpinned), build args carrying secrets
- Secrets in image layers (`ENV`, `COPY .env`, credentials in `RUN`)

**Runtime privilege**
- `privileged: true`, `cap_add`, mounted `/var/run/docker.sock`, host network mode
- Volume mounts (`- .:/var/www`), writable bind mounts, `:ro` missing

**Daemon & registry**
- Docker daemon TCP (`2375`/`2376`) exposure
- Registry auth, image provenance

## High-Value Targets

- Dev-only services exposed on `0.0.0.0`: `mailhog` (8025), `adminer`/`phpMyAdmin`, `redis` (6379, no auth), `mysql` (3306), `elasticsearch` (9200), `minio` console
- `docker.sock` mounted into a container (→ host root)
- `privileged: true` / `cap_add: SYS_ADMIN` containers
- Secrets committed in `.env`, `docker-compose.override.yml`, or baked into image layers
- `mysql`/`redis` with default or empty passwords (Laradock defaults)
- Xdebug enabled and exposed, `workspace` container reachable

## Reconnaissance

- Enumerate published ports: `docker compose ps`, `docker ps --format '{{.Names}} {{.Ports}}'`, or external `nmap -p 3306,6379,8025,9200,9000,8080 <host>` (see `tooling/nmap.md`)
- Inspect compose: `grep -nE "ports:|privileged|docker.sock|cap_add|network_mode" docker-compose.yml`
- Secrets in layers: `docker history --no-trunc <image>`; scan image with `trivy image <image>` (free, local)
- Check committed secrets: `git log -p -- .env docker-compose.override.yml`; run `gitleaks` (see `custom/source_aware_sast.md`)
- Redis/MySQL auth: `redis-cli -h <host> ping`, `mysql -h <host> -u root`

## Testing Techniques

**Exposed data services**
- Connect directly to `mysql`/`redis`/`elasticsearch`/`minio` on mapped host ports. Laradock defaults often have weak/empty creds. Redis without `requirepass` = full read/write, possible RCE via module/config. See `vulnerabilities/weak_password_detection.md`.

**Admin panels**
- Reach `adminer`/`phpMyAdmin`/`mailhog` on their host ports; these leak DB contents and captured mail. Should never bind publicly.

**Container escape surface (config review)**
- Flag `privileged: true`, `cap_add`, host `network_mode`, and `/var/run/docker.sock` mounts. `docker.sock` in a web/workspace container = trivial host root. No exploit needed to report — the mount is the finding.

**Secrets in images**
- `docker history` / `trivy` for baked env/creds; `COPY .env` into image ships secrets to anyone pulling it.

**Dev config in prod**
- Xdebug port open, `APP_DEBUG=true`, `:latest` unpinned images, source bind-mount in a prod compose. See `frameworks/laravel.md` for the app-side debug leak.

## Remediation Anchors

- Bind dev services to `127.0.0.1:` only (`ports: "127.0.0.1:3306:3306"`); never `0.0.0.0` in shared/prod.
- Set strong `MYSQL_ROOT_PASSWORD`, `REDIS_PASSWORD` (`requirepass`); no defaults.
- Never mount `docker.sock` into app containers; drop `privileged`, minimize `cap_add`.
- Secrets via runtime env / Docker secrets, never `COPY .env` or build args; keep `.env` out of git.
- Pin image tags to digests; `trivy image` in CI (free).
- Separate compose for dev (Laradock) vs prod; disable Xdebug and `APP_DEBUG` in prod.
