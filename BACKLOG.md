# Backlog do Gesttão

Lista do que falta fazer no sistema. A versão principal fica na planilha
"Backlog do Gesttão" (https://claude.ai/artifact/92uNEeXreDbBKy5QpTbn97);
esta cópia fica no repositório para quem trabalha no código. Ao mudar um
item, atualize os dois.

Status: **A fazer**, **Em andamento**, **Aguardando retorno**, **Feito**.

## A fazer

### Dashboard financeiro: gráfico de lucro x custos
- Prioridade: alta · Área: Financeiro · Criado em 11/11/2026
- Tela nova com um gráfico em **verde (lucro)** e **vermelho (custos)**.

### Reduzir leituras do Firestore
- Prioridade: alta · Área: Infraestrutura · Criado em 11/11/2026
- A cota diária estourou em 10/11 e derrubou o sistema (erro
  `RESOURCE_EXHAUSTED`). Opções: plano pago do Firebase, cache ou paginação.

## Feito

### Nome fantasia e CEP no cadastro de clientes
- Prioridade: média · Área: Cadastros · Criado em 11/11/2026
- CEP preenche rua, bairro, cidade e estado sozinho (ViaCEP). Publicado no
  `main` (commit `8066f4f`), sem teste na tela por causa da cota do Firestore.

### Novo visual de todas as telas
- Prioridade: média · Área: Layout · Criado em 11/11/2026
- Fonte Geist corrigida (estava em Times New Roman), cartões, tabelas,
  campos e botões mais limpos, sem mudar nada de lugar. Publicado no `main`
  (commit `c466f8e`).

### Busca instantânea na lista de pedidos
- Prioridade: média · Área: Pedidos · Criado em 11/11/2026
- Por cliente ou número, ignora acentos. Publicado no `main` (commit `e8538ce`).
