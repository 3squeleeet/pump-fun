# Pump Lab 2

Terminal desktop independente com mercado e saldo de demonstração. Sem vínculo com Pump.fun e sem transações reais.

## Baixar e abrir no Windows 64 bits

Na aba **Actions**, abra **Gerar aplicativo Windows** e a execução mais recente. Quando estiver verde, baixe **PumpLab-Windows-x64** em **Artifacts**, conectado à sua conta do GitHub. Extraia **todo** o ZIP e abra `PumpLab.exe`; mantenha as DLLs e pastas junto do executável. Não precisa de Node.js. O pacote não tem assinatura digital. Cada envio à branch `main` inicia um build; **Run workflow** gera novamente. Os artefatos expiram em 14 dias.

## Mercado em movimento

36 moedas com históricos independentes e seis perfis: estável, alta gradual, baixa gradual, volátil, reversão e rompimentos. Os preços, velas, negócios, estimativas e posições são atualizados a cada segundo. Os períodos 1H, 4H, 1D e 1S (uma semana) mantêm históricos separados, com o mesmo último preço usado nas ordens. Trocar de moeda não regenera seu gráfico. A valorização da carteira acompanha o preço atual.

O motor não consulta cotações reais. Preços iniciais são referências ilustrativas. Saldo, posições, favoritos, gráficos, configurações e eventos ficam armazenados no dispositivo. A carteira existente da versão anterior é preservada; comece com US$ 10.000 de demonstração em uma sessão nova. Há 9 ícones reais locais e avatares de iniciais nas demais moedas.

## Controles: Alt + P

1. Aperte **Alt + P** ou clique em **CONTROLES** na barra superior.
2. Selecione `/pump-lab/runtime` e clique em **Inject** para ativar todos os módulos. Também é possível ativar `market/`, `wallet/` ou `scheduler/` individualmente.
3. Selecione qualquer moeda. Pump e dump alteram o preço desse ativo, o gráfico, o preço de execução e o patrimônio das posições.

O painel é um console local do aplicativo: **Inject não injeta código em outros programas nem abre pastas reais do sistema**.

- Pump de até 10.000%; dump de até 99%. O percentual é aplicado sobre o preço vigente; pump de 50% seguido de dump de 50% não retorna ao preço inicial.
- **Espera** agenda o início em segundos; **duração** distribui a alteração progressivamente. Ambos em zero aplicam instantaneamente. O movimento natural continua, portanto o preço final também inclui sua variação. Pause o motor ou congele a moeda para isolar um evento.
- Fila de eventos, progresso e cancelamento individual ou de todos. Cancelar preserva os movimentos já aplicados. Limite de 50 eventos pendentes.
- Perfil, volatilidade de 0,1× a 10×, tendência por minuto e congelamento por moeda. Mudanças de perfil afetam os próximos movimentos, sem reescrever o passado.
- Velocidade global de 0,25× a 10× e pausa do movimento natural. **Agendamentos usam segundos reais, independentemente da velocidade e da pausa.**
- Adicionar, retirar ou definir saldo; vender posições; reiniciar a carteira com confirmação; restaurar o preço/histórico de uma moeda com confirmação; exportar uma sessão JSON para backup/inspeção.

Mantenha o aplicativo aberto para acompanhar os eventos no horário previsto. O sistema operacional pode limitar atualizações em segundo plano. Ao retomar/reabrir, os eventos vencidos são concluídos, sem duplicar efeitos já aplicados; não há um serviço externo executando com o aplicativo fechado. Os módulos do painel precisam ser ativados novamente a cada abertura do app, mas as configurações e agendas são preservadas.

Os depósitos e saques ajustam somente créditos locais: não envie dinheiro ou cripto. O aplicativo não coleta endereço de depósito, dados bancários, documentos nem chaves privadas.

## Desenvolvimento

Requer Node.js 22+ e npm. Use o checkout existente da tarefa; não é necessário criar worktrees.

```sh
npm ci
npm start
```

`npm run dev` serve a interface para testes no navegador. `npm test` valida o motor e a carteira. `npm run build:win` gera `dist/PumpLab-win32-x64/`.

Na nuvem, preserve o proxy herdado e habilite seu suporte nos downloads do Electron:

```sh
ELECTRON_GET_USE_PROXY=1 npm ci
ELECTRON_GET_USE_PROXY=1 npm run build:win
```

O workflow Windows executa os testes e empacota o aplicativo. Validações locais incluem testes do motor e fluxos de interface no Chromium/Linux; a execução do .exe no Windows deve ser verificada no Windows.

Ícones: [cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons), licença [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/). Nomes e símbolos pertencem aos respectivos projetos.
