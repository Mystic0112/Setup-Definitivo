---
name: pm-ref
description: Referência de gestão de projetos — metodologias, estimativas, priorização e frameworks de PM. Carregue ao planejar entrega, estimar ou priorizar; templates de documento o agente já alcança via templates-doc-pm.
user-invocable: false
---

# Gestão de Projetos

Referência de domínio carregada sob demanda (extraída do núcleo do agente para economizar contexto).

### Comparativo de Metodologias

| Dimensão | Scrum Clássico | Shape Up (Basecamp) | Kanban |
|---|---|---|---|
| Ciclo | Sprint 2 semanas | 6 semanas fixas | Fluxo contínuo |
| Backlog | Refinado semanalmente | Sem backlog permanente — pitches pontuais | WIP limits por coluna |
| Estimativa | Story points / velocity | Appetite (quanto vale investir) | Lead time / throughput |
| Planejamento | Sprint planning semanal | Betting Table pré-ciclo (1-2h) | Pull quando há capacidade |
| Melhor para | Times médios com produto estável | Squads pequenos com autonomia alta | Suporte, ops, bugs |

**Shape Up na prática:** PM escreve um *pitch* (problema + solução esboçada + rabbit holes + apetite de tempo). Na Betting Table, o time aposta ou descarta — sem extensão de prazo. Se não entregou em 6 semanas, o projeto não continua automaticamente.

**Kanban moderno:** Use WIP limits reais (ex: máx 2 itens em "In Review" por dev). Monte *cumulative flow diagrams* para detectar gargalos antes que virem atraso.

### Estimativas Modernas

- **Story Points:** úteis para velocity tracking em Scrum maduro. Problema: debates de "é 3 ou 5?" desperdiçam tempo.
- **T-shirt sizes (P/M/G/GG):** mais rápido para grooming de roadmap e alta-demanda. Converta para horas apenas no sprint planning.
- **#NoEstimates:** 18% dos times ágeis em 2025 eliminaram estimativas. Funcionam com stories uniformemente pequenas + throughput (stories/semana) como previsão.
- **Regra prática:** use T-shirt para roadmap, Story Points (ou nada) no sprint, e decomponha qualquer item > G em subtasks antes de entrar no ciclo.

### DORA Metrics — O Que Medir e Como Usar

As 4 métricas core (+ nova de 2024):

| Métrica | Elite (referência 2025) | O que indica |
|---|---|---|
| Deployment Frequency | Várias vezes/dia | Maturidade de CI/CD |
| Lead Time for Changes | < 1 hora | Eficiência do processo dev→prod |
| Change Failure Rate | < 5% | Qualidade de testes e review |
| Failed Deploy Recovery Time* | < 1 hora | Resiliência operacional |
| Rework Rate (novo 2024) | < 10% | Qualidade de requisitos upstream |

*Renomeado de MTTR em 2024 — foco exclusivo em falhas causadas por deploy.

**Como usar nas decisões:** se Lead Time alto → gargalo em review ou CI lento; se CFR alto → investir em testes antes de aumentar frequência de deploy; se Recovery Time alto → melhorar observabilidade e runbooks.

---

