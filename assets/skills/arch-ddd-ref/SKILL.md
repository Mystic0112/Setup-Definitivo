---
name: arch-ddd-ref
description: Referência de arquitetura e DDD aplicada ao stack da squad — DDD em Laravel, modular monolith, API design moderno, event-driven e architecture fitness functions. Carregue ao decidir estrutura de sistema, aplicar DDD tático ou avaliar fronteiras de módulo — puxe só quando a decisão de arquitetura for real.
user-invocable: false
---

# Arquitetura & DDD

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### DDD em Laravel

Estruturar bounded contexts como módulos PHP dentro do monolito:

```
app/
  Modules/
    Billing/
      Domain/          # Entities, Value Objects, Aggregates, Domain Events
      Application/     # Use Cases, Commands, Queries, DTOs
      Infrastructure/  # Eloquent Models, Repositories, Queue Jobs
      Http/            # Controllers, Requests, Resources (adaptador de entrada)
```

- **Domain layer**: zero dependência de Laravel ou qualquer framework
- **Application layer**: orquestra o domínio, dispara eventos, chama repositórios via interface
- **Infrastructure layer**: implementa as interfaces definidas no domínio (Eloquent, Redis, S3)
- Use `deptrac` para enforçar que as camadas não se cruzem em CI

### Modular Monolith

O padrão dominante em 2025 para times pequenos e médios:

- Módulos comunicam-se via **interfaces públicas** (Facade de Application), nunca acessando camadas internas diretamente
- Eventos de domínio para comunicação assíncrona entre módulos no mesmo processo
- Cada módulo pode ter sua própria migration e service provider
- Quando um módulo precisar de escala independente: extrai para serviço sem reescrever — a fronteira já está definida

### API Design Moderno

- **Contract-first**: escreva o OpenAPI 3.1 antes do código — gere stubs, valide contratos em CI
- **Versionamento REST**: `/api/v1/` na URL para breaking changes; evite header versioning (dificulta cache e debug)
- **GraphQL**: use internamente para agregação de dados de múltiplos contextos; evite como API pública de primeiro contato
- **gRPC**: comunicação interna entre serviços com contratos fortes e alta performance
- **HATEOAS**: vale a pena apenas quando clientes realmente navegam hypermedia — não aplique por dogma REST
- **Deprecation strategy**: marque campos como `deprecated` no schema com data de remoção; notifique consumidores com antecedência mínima de 6 meses

### Event-Driven

- **Eventos de domínio**: ocorrem dentro do bounded context, síncronos, disparam efeitos colaterais locais
- **Eventos de integração**: cruzam bounded contexts, assíncronos via fila (Laravel Queue + Redis/SQS)
- Nunca use um evento de integração onde uma chamada direta de Application Service resolve
- Garanta idempotência nos listeners de integração — mensagens podem chegar duplicadas

### Architecture Fitness Functions

Testes automatizados que verificam conformidade arquitetural continuamente:

- **Deptrac**: define regras de dependência entre camadas/módulos e quebra o CI se violadas
- **PHPStan nível 8+**: tipagem forte como barreira arquitetural — código sem tipo é código sem contrato
- **Mutation Testing (Infection)**: verifica se os testes realmente cobrem o comportamento do domínio
- Adicione fitness functions junto com a decisão arquitetural — sem enforcement, regras viram sugestões
