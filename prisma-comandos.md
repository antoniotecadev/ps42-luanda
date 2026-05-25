# Prisma Commands

Resumo rápido dos comandos Prisma mais úteis neste projecto.

## Validar e formatar

- `npx prisma validate` - valida o `schema.prisma`.
- `npx prisma format` - formata o `schema.prisma`.

## Gerar cliente

- `npx prisma generate` - gera o Prisma Client depois de mudar o schema.

## Migrações

- `npx prisma migrate dev --name nome_da_migration` - cria e aplica uma migration em desenvolvimento.
- `npx prisma migrate deploy` - aplica migrations pendentes, normalmente em produção.
- `npx prisma migrate status` - mostra o estado das migrations.
- `npx prisma migrate reset` - reseta o banco e reaplica migrations, usado só em dev.

## Sincronização direta do schema

- `npx prisma db push` - envia o schema para o banco sem criar migration.
- `npx prisma db pull` - lê o banco e actualiza o schema.

## Interface visual

- `npx prisma studio` - abre a interface visual para ver e editar dados.

## Dica de uso neste projecto

Depois de alterar o `prisma/schema.prisma`, o fluxo normal costuma ser:

1. `npx prisma format`
2. `npx prisma migrate dev --name nome_da_migration`
3. `npx prisma generate`
