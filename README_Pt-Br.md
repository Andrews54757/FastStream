[![logotext1](https://github.com/user-attachments/assets/cefd20ba-606a-482c-a522-36b3419e93c7)](https://faststream.online)

# FastStream
Cansado de ver vídeos travando por causa da internet lenta? Frustrado com a falta de recursos de acessibilidade em alguns sites? Esta extensão substitui os vídeos dos sites por um reprodutor de vídeo projetado para sua conveniência. Diga adeus ao pré-carregamento e olá para uma experiência de vídeo mais acessível!

1. Assista a vídeos sem interrupções, pré-carregando o vídeo em segundo plano. Fragmentação automática e solicitações paralelas para velocidades de download até 6x mais rápidas.
2. Recursos avançados de legendas incluem: personalização da aparência das legendas, suporte integrado ao OpenSubtitles para encontrar legendas na internet e uma ferramenta intuitiva de sincronização para ajustar o tempo das legendas em tempo real.
3. Dinâmica de áudio ajustável (equalizador, compressor, mixer, modo mono, amplificador de volume) e configurações de vídeo (brilho, contraste, matiz, daltonização LMS para daltonismo) para suas preferências audiovisuais únicas.
4. Mais de 20 atalhos de teclado remapeáveis e botões acessíveis para facilitar o controle do player.
5. Disponível em vários idiomas! Traduzido para espanhol, japonês, russo, malaio e italiano pela comunidade FastStream. Suporte para mais idiomas em breve!

O player atualmente suporta:
- Vídeos MP4 (.mp4)
- Streams HLS (.m3u8)
- Streams DASH (.mpd)
- Youtube (download não suportado no Chrome, a menos que instalado manualmente devido à política da loja do Google)

Para usar o player, basta:
1. Acessar qualquer site com um vídeo e ativar a extensão. Qualquer vídeo detectado será automaticamente substituído pelo player FastStream.
2. Alternativamente, você pode simplesmente clicar ou navegar até um arquivo de manifesto de stream (m3u8/mpd) para começar a reproduzir.
3. Abra uma nova aba e clique no ícone da extensão para acessar o player. Reproduza fontes detectadas em outras abas através do Navegador de Fontes. Você também pode arrastar e soltar arquivos de vídeo do seu computador.

Observações:
- Transmissões ao vivo não são suportadas. Não haverá suporte para elas em um futuro próximo.
- Este player não funciona com conteúdo protegido por DRM (Netflix/Amazon etc). Isso é intencional. Por favor, use esta ferramenta de forma responsável. O FastStream não deve ser usado para violar direitos autorais.
- Este player ainda está em desenvolvimento. Por favor, relate qualquer problema no Github: https://github.com/Andrews54757/FastStream/issues
- Para sua privacidade, esta extensão não coleta dados de telemetria. Também não requer recursos adicionais da internet para funcionar. Ela funciona totalmente desconectada da rede. Sinta-se à vontade para conferir o código no Github.
- Levamos a acessibilidade a sério. Se você precisa de algum recurso que ainda não está disponível, entre em contato conosco e trabalharemos nisso o mais rápido possível. Também fique à vontade para sugerir novos recursos ou melhorias no Github!
- O tamanho máximo padrão para pré-carregamento é de 5GB. Isso pode ser alterado na página de configurações. Fique atento ao espaço de armazenamento do seu computador ao mudar essa configuração. Os navegadores transferem dados da RAM para o SSD se o vídeo for muito grande. Pré-carregar vídeos grandes com frequência pode reduzir a vida útil do seu SSD.

## Demo

Veja o player em ação sem instalar a extensão! Testado no Chrome e Firefox. Observação: Alguns recursos (OpenSubtitles/sobrescrever cabeçalhos) não estão disponíveis sem a instalação.

[Web Version + Big Buck Bunny](https://faststream.online/player/#https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8)

## Youtube
Temos visto problemas com o Youtube não funcionando para algumas pessoas usando o FastStream. Isso acontece devido a um esforço contínuo do Google para dificultar o uso de clientes de terceiros e bloqueadores de anúncios. Se você estiver tendo problemas com o Youtube, por favor, nos avise no Github na área de "issues"!

## Compatibilidade com navegadores
Testado no Chrome e Firefox. Outros navegadores baseados em Chromium (como o Edge) provavelmente também funcionarão.

Por favor, note que não há planos para tornar o FastStream compatível com dispositivos móveis tão cedo. Desenvolver o FastStream para Chrome e Firefox no desktop já é um trabalho exaustivo. Suportar dispositivos móveis é trabalhoso demais para um simples estudante universitário programador como eu. Dito isso, se você encontrar uma maneira de fazê-lo funcionar em mais navegadores ou dispositivos, fique à vontade para compartilhar e enviar uma pull request!


## Instalação para Chrome e Firefox

Você pode encontrar a extensão na Chrome Web Store
(https://chrome.google.com/webstore/detail/faststream/kkeakohpadmbldjaiggikmnldlfkdfog)

Também está disponível para [Firefox](https://addons.mozilla.org/en-US/firefox/addon/faststream/)

## Instalação Manual para Chrome

As políticas da loja do Chrome não permitem extensões que possam baixar vídeos do Youtube. Sendo assim, o FastStream não pode salvar vídeos do Youtube se instalado pela loja oficial. Para obter recursos restritos, siga os passos abaixo:

1. Acesse chrome://extensions
2. Ative o modo de desenvolvedor
3. Arraste e solte o diretório chrome deste repositório

**NÃO HÁ UM SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA INTEGRADO. Se você optar por esse método, lembre-se de verificar frequentemente por atualizações, pois costumo corrigir bugs conforme eles aparecem. O FastStream irá lembrá-lo na página de configurações, mas você terá que atualizar manualmente.

##Instalação Manual para Firefox
A extensão, por padrão, está configurada para funcionar no Chrome. Você pode usar uma versão pré-compilada na página de [Releases page](https://github.com/Andrews54757/FastStream/releases) ou compilar a extensão você mesmo seguindo as instruções abaixo.

Você pode instalar a extensão no Firefox Developer Edition acessando `about:config` e definindo `xpinstall.signatures.required` como `false`. Você também deve desativar as atualizações automáticas de extensões, ou a extensão será removida ao fechar o navegador. Para isso, vá em `about:addons`, clique no ícone de engrenagem e desmarque `Atualizar complementos automaticamente`. Depois, clique em `Instalar complemento a partir de arquivo` e selecione o arquivo `firefox-libre-*.zip` para instalar a extensão.

**NÃO HÁ UM SISTEMA DE ATUALIZAÇÃO AUTOMÁTICA INTEGRADO. Veja acima.

## Instruções de Build (criar pacotes)
Para criar pacotes para Chrome e Firefox, você precisa compilar o FastStream seguindo estes passos:

1. Instale o NodeJS e o NPM
2. Execute npm install --only=dev para instalar as dependências de desenvolvimento
3. Execute npm run build
4. O pacote para Firefox estará disponível no diretório built

Arquivos com `dist` no nome são para as lojas do Chrome e Firefox. Arquivos com libre são para instalação manual. As versões `dist` terão menos recursos para cumprir as políticas das lojas.

## Creditoss

Muito obrigado aos colaboradores deste projeto.

#### Desenvolvedores
- Andrews54757: Líder de desenvolvimento
- ChromiaCat: Ícone de notificação de atualização (PR #142)
- frenicohansen: SRT/ASS legendas WebVTT (PR #323)

#### Tradutores
- Dael (dael_io): Consertado tradução para Espanhol
- reindex-ot: tradutor de Japonês
- elfriob: tradutor de Russo
- Justryuz: tradutor idioma Malay
- CommandLeo: tradutor de Italiano
- andercard0: tradutor de Português do Brasil
- MrMysterius: tradutor de Alemão

#### Bibliotecas de código aberto

- [hls.js](https://github.com/video-dev/hls.js): Used for HLS playback
- [dash.js](https://github.com/Dash-Industry-Forum/dash.js): Used for DASH playback
- [mp4box.js](https://github.com/gpac/mp4box.js): Used for automatic fragmentation of mp4 files
- [youtube.js](https://github.com/LuanRT/YouTube.js): Used for Youtube playback
- [vtt.js](https://github.com/mozilla/vtt.js): Used for parsing VTT subtitles
- [jswebm](https://github.com/jscodec/jswebm): Used for demuxing webm files
- And some more! Check the `chrome/player/modules` directory for more information.

##  Política de Financiamento e Doações

O FastStream não aceita doações para o projeto como um todo. Por favor, veja em [wiki](https://github.com/Andrews54757/FastStream/wiki/Funding) para mais detalhes.

## Detalhes técnicos

Por favor verificar em [wiki](https://github.com/Andrews54757/FastStream/wiki/Technical-Details) para maiores informações ténicas e detalhes!
  
## Aviso Legal

Embora seja possível que o FastStream salve vídeos de qualquer site, desde que não haja DRM, isso não significa que você tenha o direito legal de fazê-lo se não for o proprietário do conteúdo. Por favor, use esta ferramenta com responsabilidade. O FastStream não deve ser utilizado para violar direitos autorais.