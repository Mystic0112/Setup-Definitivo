# Atribuição

## Strix (maioria dos playbooks)

A maior parte dos playbooks vem do projeto **Strix**:

- Fonte: https://github.com/usestrix/strix
- Licença: Apache License 2.0

Redistribuídos sob os termos da Apache-2.0, que permite redistribuição mediante
atribuição e manutenção do aviso de licença. O texto completo está em
https://www.apache.org/licenses/LICENSE-2.0

Os playbooks Strix são redistribuídos sem modificação de conteúdo.

## claude-red (adições em `custom/`)

Estes playbooks em `custom/` são adaptados do projeto **claude-red**:

- Fonte: https://github.com/SnailSploit/claude-red
- Licença: MIT
- Arquivos: `network_attacks.md`, `fuzzing.md`, `crypto_attacks.md`,
  `mobile_pentest.md`, `linux_privesc.md`

Adaptação feita na ingestão: o frontmatter YAML foi reescrito para o padrão dos
playbooks Strix (`name` + `description` de uma linha) e o wrapper de skill do
claude-red foi removido. O corpo da metodologia foi preservado. A licença MIT
permite modificação e redistribuição mediante atribuição; o aviso de copyright
original está preservado no repositório de origem.
