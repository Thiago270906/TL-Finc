-- CreateEnum
CREATE TYPE "Recorrencia" AS ENUM ('NAO', 'DIARIAMENTE', 'SEMANALMENTE', 'MENSALMENTE');

-- CreateEnum
CREATE TYPE "TipoLancamento" AS ENUM ('DESPESA', 'RECEITA');

-- CreateEnum
CREATE TYPE "StatusLancamento" AS ENUM ('PENDENTE', 'PAGO', 'CANCELADO');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "imagem" TEXT,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plano_contas" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_contas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lancamento_financeiro" (
    "id" TEXT NOT NULL,
    "tipo" "TipoLancamento" NOT NULL,
    "descricao" TEXT NOT NULL,
    "beneficiario" TEXT,
    "valor" DECIMAL(15,2) NOT NULL,
    "dt_vencimento" TIMESTAMP(3) NOT NULL,
    "dt_pagamento" TIMESTAMP(3),
    "numero_documento" TEXT,
    "plano_contas_id" TEXT NOT NULL,
    "status" "StatusLancamento" NOT NULL DEFAULT 'PENDENTE',
    "recorrencia" "Recorrencia" NOT NULL DEFAULT 'NAO',
    "numero_parcelas" INTEGER,
    "parcela_atual" INTEGER,
    "grupo_parcela_id" TEXT,
    "lancamento_pai_id" TEXT,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dt_update" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamento_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagamento_parcial" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "dt_pagamento" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "dt_insert" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagamento_parcial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "anexo_financeiro" (
    "id" TEXT NOT NULL,
    "lancamento_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dt_upload" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexo_financeiro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_status_idx" ON "lancamento_financeiro"("status");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_dt_vencimento_idx" ON "lancamento_financeiro"("dt_vencimento");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_plano_contas_id_idx" ON "lancamento_financeiro"("plano_contas_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_grupo_parcela_id_idx" ON "lancamento_financeiro"("grupo_parcela_id");

-- CreateIndex
CREATE INDEX "lancamento_financeiro_lancamento_pai_id_idx" ON "lancamento_financeiro"("lancamento_pai_id");

-- CreateIndex
CREATE INDEX "pagamento_parcial_lancamento_id_idx" ON "pagamento_parcial"("lancamento_id");

-- CreateIndex
CREATE INDEX "anexo_financeiro_lancamento_id_idx" ON "anexo_financeiro"("lancamento_id");

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_plano_contas_id_fkey" FOREIGN KEY ("plano_contas_id") REFERENCES "plano_contas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lancamento_financeiro" ADD CONSTRAINT "lancamento_financeiro_lancamento_pai_id_fkey" FOREIGN KEY ("lancamento_pai_id") REFERENCES "lancamento_financeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagamento_parcial" ADD CONSTRAINT "pagamento_parcial_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexo_financeiro" ADD CONSTRAINT "anexo_financeiro_lancamento_id_fkey" FOREIGN KEY ("lancamento_id") REFERENCES "lancamento_financeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
