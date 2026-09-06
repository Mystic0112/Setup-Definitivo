---
name: api-docs-ref
description: Referência para documentar APIs com OpenAPI/Swagger — escolha entre Scramble, L5-Swagger e Scribe no Laravel, diferenciais do OpenAPI 3.1, securitySchemes com Sanctum, padrões obrigatórios por endpoint e fluxo contract-first. Carregue ao gerar, revisar ou publicar spec de API.
user-invocable: false
---

# Documentação de API (OpenAPI / Swagger)

## Ferramentas para Laravel — quando usar cada uma

| Ferramenta | Abordagem | Quando usar |
|------------|-----------|-------------|
| **Scramble** | Zero-annotation — analisa código estaticamente | Projetos novos; quem quer doc sempre sincronizada sem esforço manual |
| **L5-Swagger** | Annotation manual (PHPDoc + swagger-php) | Projetos legados; quando precisar de controle total sobre cada detalhe do spec |
| **Scribe** | Semi-automático — infere + permite override manual | Times que querem equilíbrio entre automação e personalização; gera também coleção Postman |

**Recomendação padrão:** Scramble em projetos novos (Laravel 11+). L5-Swagger em projetos com contratos externos rígidos ou legados.

## OpenAPI 3.1 — diferenciais práticos sobre 3.0

- **Full JSON Schema 2020-12**: `type` aceita array (`["string", "null"]`), elimina `nullable: true`
- **Webhooks**: campo `webhooks` de primeiro nível (antes exigia workaround com `paths`)
- **`$schema` por componente**: permite especificar dialeto JSON Schema por objeto
- **Licença via SPDX**: campo `identifier` em `info.license` para identifiers padronizados
- Scramble e L5-Swagger (via swagger-php 5+) já suportam 3.1 nativamente

## Padrões obrigatórios em todo endpoint documentado

- `summary` curto (máx 60 chars) + `description` com casos de uso reais
- `operationId` único e descritivo: `getUserById`, `createOrder`
- Exemplos concretos em `requestBody` e em cada `response` — nunca deixar vazio
- Todos os status codes documentados: 200, 201, 400, 401, 403, 404, 422, 500
- Schemas de erro padronizados com `$ref` reutilizável (ex: `#/components/schemas/ValidationError`)
- Tags agrupando endpoints por domínio (`users`, `orders`, `auth`)

## Documentando autenticação Sanctum no OpenAPI

```yaml
components:
  securitySchemes:
    sanctum:
      type: http
      scheme: bearer
      bearerFormat: JWT  # ou "Sanctum Token"
security:
  - sanctum: []  # aplica globalmente; sobrescrever por rota se necessário
```

No Scramble: configurar em `config/scramble.php` com `'security' => [new BearerSecurityScheme]`.
No L5-Swagger: anotação `@OA\SecurityScheme` no controller base ou em `AppServiceProvider`.

## Contract-First: fluxo com OpenAPI

1. Escrever o spec YAML/JSON antes do código (design-first)
2. Validar o spec com `spectral lint openapi.yaml`
3. Gerar stubs de controller e DTOs com `openapi-generator-cli`
4. Subir mock server com Prism para o frontend consumir antes da implementação
5. Usar o spec como contrato em testes de integração (ex: `spectral` + `phpunit`)
6. Em code-first (Scramble): publicar spec gerado em rota protegida e versionar no git
