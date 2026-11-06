# Portal Cícero Dantas

Site de notícias com painel administrativo. Não precisa instalar nenhuma biblioteca, só o **Node.js** (versão 18 ou mais nova).

## Como ligar

Abra o Terminal nesta pasta e rode:

```bash
node servidor.js
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin

Para usar outra porta: `PORT=8080 node servidor.js`

## Primeiro acesso

1. Na primeira vez que o servidor liga, ele cria o usuário **admin** e grava a senha em `dados/SENHA-INICIAL.txt`.
2. Entre no painel com essa senha. O painel pede para você criar uma senha nova.
3. Depois de trocar a senha, **apague** o arquivo `dados/SENHA-INICIAL.txt`.

## O que dá para fazer no painel

| Tela | Para que serve |
|---|---|
| Visão geral | Números do site, mais lidas e últimas alterações |
| Nova notícia | Escrever e publicar: título, texto, foto, editoria, destaque na capa, rascunho ou agendamento |
| Notícias | Buscar, filtrar, editar e excluir |
| Patrocinadores | Enviar banners (topo, lateral, feed, matéria) e logos de apoiadores com link |
| Configurações | Nome, slogan, WhatsApp, e-mail, redes sociais e chave do brapi (Ibovespa) |
| Usuários | Criar logins para a equipe (Editor ou Administrador) |

**Dicas para o texto:** separe os parágrafos com uma linha em branco. Para fazer um intertítulo, comece a linha com `## `. Para uma citação, comece com `> `.

As fotos enviadas pelo painel são reduzidas automaticamente e salvas em `uploads/`.

## Arquivos importantes

- `dados/banco.json`: **todo o conteúdo do site** (notícias, usuários, patrocinadores). Faça cópia de segurança dele.
- `uploads/`: fotos e banners enviados.
- `js/dados.js`: conteúdo de exemplo, usado só na primeira vez que o banco é criado.

## Colocar na internet

É preciso uma hospedagem que rode **Node.js**: VPS (Hostinger VPS, DigitalOcean, Contabo), Render, Railway etc. Hospedagem só de PHP ou site estático não serve para o painel.

O projeto já tem um `Dockerfile`. Configure estas variáveis na hospedagem:

| Variável | Valor | Para quê |
|---|---|---|
| `DATA_DIR` | `/data` | Pasta permanente (volume) onde ficam o banco e as fotos |
| `ADMIN_SENHA` | uma senha forte | Senha do admin no primeiro acesso |
| `TRUST_PROXY` | `1` | Login seguro atrás do HTTPS da hospedagem |

**Importante:** sem um volume/disco permanente em `DATA_DIR`, as notícias somem a cada atualização do site. Use HTTPS (cadeado) para proteger o login.
