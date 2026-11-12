#!/usr/bin/env bash
# Publica o branch main no servidor gestao.bonavenitt.com.br (Meu-Servidor, HestiaCP).
# Uso (Git Bash, na pasta do projeto): bash scripts/publicar-servidor.sh
#
# Monta a versão nova numa pasta ao lado, compila e só troca se o build passar.
# O .env do servidor é mantido. A versão anterior fica em gesttao-anterior.
set -euo pipefail

CHAVE="${CHAVE:-$HOME/.ssh/gesttao_deploy}"
DESTINO="gtbonav5@38.250.8.172"
PORTA=35035
APP="web/gestao.bonavenitt.com.br/private/node"

ssh_srv() { ssh -i "$CHAVE" -p "$PORTA" -o BatchMode=yes "$DESTINO" "$@"; }

git fetch -q origin
VERSAO=$(git rev-parse --short origin/main)
echo "Publicando origin/main ($VERSAO)..."

ssh_srv "rm -rf $APP/gesttao-novo && mkdir -p $APP/gesttao-novo"
git archive --format=tar origin/main | ssh_srv "tar -x -C $APP/gesttao-novo"

ssh_srv "set -e; source ~/.nvm/nvm.sh >/dev/null
  cd $APP/gesttao-novo
  cp ../gesttao/.env .env && chmod 600 .env
  sed -i 's#\"start\": \"next start\"#\"start\": \"next start -H 127.0.0.1\"#' package.json
  npm ci --no-audit --no-fund
  NEXT_TELEMETRY_DISABLED=1 npm run build
  cd ..
  rm -rf gesttao-anterior
  mv gesttao gesttao-anterior
  mv gesttao-novo gesttao
  pm2 restart hst-gesttao --update-env >/dev/null
  sleep 5
  curl -s -o /dev/null -w 'Servidor respondeu %{http_code} em /login\n' http://127.0.0.1:20000/login"

echo "Pronto: https://gestao.bonavenitt.com.br ($VERSAO)"
