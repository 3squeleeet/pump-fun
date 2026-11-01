# Pump Lab

Simulador desktop independente inspirado em terminais de negociação de moedas. Sem vínculo com Pump.fun e sem transações reais.

## Windows 64 bits

Extraia **todo** o ZIP `PumpLab-Windows-x64.zip` e abra `PumpLab.exe` na pasta extraída. Mantenha as DLLs e as pastas do pacote junto do executável. Não requer Node.js. O pacote não tem assinatura digital.

Inclui 36 moedas com nomes reais, 9 ícones reais incluídos localmente e avatares com iniciais para as demais, preços ilustrativos, gráficos de velas por período, busca, favoritos, carteira, histórico, compra, venda, depósito e saque fictícios. O saldo inicial é US$ 10.000 virtuais. Os dados ficam no armazenamento local do aplicativo e sobrevivem ao fechamento.

Nenhum depósito ou saque movimenta dinheiro; o aplicativo não pede chaves privadas, endereço, documento ou dados bancários. Preços, estatísticas e negócios são fictícios, não cotações atuais. O preço de execução é a referência fixa da moeda; o gráfico é ilustrativo.

## Baixar pelo GitHub Actions

Abra a aba **Actions**, selecione **Gerar aplicativo Windows** e abra a execução mais recente. Quando terminar com sucesso, em **Artifacts**, baixe **PumpLab-Windows-x64**. Extraia todo o arquivo e abra `PumpLab.exe`. É necessário estar conectado ao GitHub para baixar o artefato; ele fica disponível por 14 dias. Use **Run workflow** para gerar novamente. Cada envio à branch `main` também inicia o build.

## Desenvolvimento

Requer Node.js 22 ou superior e npm.

```sh
npm ci
npm start
```

No ambiente de nuvem, os downloads do Electron precisam usar o proxy herdado:

```sh
ELECTRON_GET_USE_PROXY=1 npm ci
ELECTRON_GET_USE_PROXY=1 npm run build:win
```

Para validar a interface no navegador: `npm run dev`. Para testar as regras de saldo: `npm test`. O pacote Windows é gerado em `dist/PumpLab-win32-x64/` pelo comando `npm run build:win`.

Os testes de interface foram executados em Chromium no Linux, incluindo persistência, busca e operações financeiras virtuais. O executável foi empacotado e identificado como PE32+ x64; não foi executado no Windows neste ambiente.

Ícones locais: [cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons), licença [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). Os nomes e símbolos pertencem aos seus respectivos projetos.
