---
name: devops-ref
description: Referência de DevOps fora do núcleo — Docker avançado, CI/CD (GitHub Actions, GitLab CI), cloud e IaC (Terraform). Carregue ao configurar pipeline, container ou infra que dependa de detalhe de ferramenta.
user-invocable: false
---

# DevOps & Infra

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### Docker Moderno

**Compose v2 (plugin nativo, não mais standalone):**
- Comando correto: `docker compose` (sem hífen) — `docker-compose` está deprecated
- `docker compose up --watch` (v2.22+): sync automático de arquivos sem rebuild, ideal para dev com hot-reload
- Profiles para ativar serviços opcionais: `docker compose --profile debug up`

**BuildKit (padrão desde Docker 23+):**
- `--secret id=mysecret,src=.env`: segredos não ficam em camadas de imagem
- `--cache-from type=registry,ref=ghcr.io/org/app:cache` + `--cache-to type=registry,mode=max`: cache entre runners de CI
- `RUN --mount=type=cache,target=/root/.cache/pip pip install ...`: cache de dependências inline

**Imagens seguras:**
- Base: `cgr.dev/chainguard/*` (distroless + rootless por padrão) ou `alpine` com `--no-cache`
- Sempre `USER nonroot` + `COPY --chown=nonroot:nonroot`
- Docker Scout (`docker scout cves`) para scan de CVEs local

---

### GitHub Actions Modernos

**Permissões mínimas (principle of least privilege):**
```yaml
permissions:
  contents: read       # padrão restritivo no topo
jobs:
  deploy:
    permissions:
      id-token: write  # só onde OIDC é necessário
      packages: write  # só onde push de imagem é feito
```

**OIDC para cloud (sem secrets de longa duração):**
```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: arn:aws:iam::123456789:role/github-deploy
    aws-region: us-east-1
# Nenhuma AWS_ACCESS_KEY_ID necessária — token é gerado e expira com o job
```

**Reusable Workflows (DRY em CI/CD):**
```yaml
# .github/workflows/deploy.yml em repo centralizado
on:
  workflow_call:
    inputs:
      environment: { type: string, required: true }
```
Workflows reutilizáveis suportam OIDC com `job_workflow_ref` como claim — cloud provider valida qual workflow originou o token.

**Pin actions por SHA (não por tag — lição do GhostAction 2025):**
```yaml
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

---

### Segurança em Pipelines CI/CD

**SLSA Framework (Supply-chain Levels for Software Artifacts):**
- **Level 1:** Build documentado, provenance gerado (JSON)
- **Level 2:** Build em CI hospedado (GitHub Actions, GCP CB) com provenance assinado
- **Level 3:** Build hermético + verificação criptográfica de inputs

**Cosign + Sigstore (assinar imagens sem chave privada permanente):**
```bash
# Em GitHub Actions (keyless signing via OIDC)
cosign sign --yes ghcr.io/org/app:sha-abc123

# Verificar antes de deploy
cosign verify --certificate-identity-regexp="https://github.com/org/app" \
  --certificate-oidc-issuer="https://token.actions.githubusercontent.com" \
  ghcr.io/org/app:sha-abc123
```
Assinaturas ficam no registry junto com a imagem; log imutável no **Rekor** (Sigstore transparency log).

**SBOM (Software Bill of Materials):**
- `syft ghcr.io/org/app:latest -o spdx-json > sbom.json` — gera inventário de dependências
- Anexar como artifact de release e atestar com Cosign: `cosign attest --type spdx`

---

