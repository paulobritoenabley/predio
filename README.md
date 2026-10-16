# Enabley · Do topo ao térreo

Landing page em 3D para terceirização de serviços (segurança, limpeza, recepção), imobiliárias e construtoras.
A página é um prédio visto de fora: o scroll desce a câmera andar por andar, e cada andar que você passa fica aceso.

**No ar:** https://paulobritoenabley.github.io/predio/

## Como abrir
A página usa módulos JavaScript, por isso precisa de um servidor local (abrir o arquivo direto no navegador não funciona).

```bash
npx serve landing
```

Ou qualquer servidor estático apontando para esta pasta.

## Estrutura
- `index.html`: todo o texto da página, em HTML real (indexável e acessível).
- `css/site.css`: tokens de cor, tipografia (Montserrat + Geist), layout desktop e celular.
- `js/world.js`: cena Three.js (prédio, cidade, obra vizinha), câmera guiada pelo scroll, painel do elevador, formulário.
- `js/textures.js`: telas do app e ambientes desenhados em canvas.
- `assets/`: logotipo Enabley, logos de clientes (com margens recortadas), `historias.mp4` (painel do saguão) e `clientes.mp4` (placa de rua do final: Chilli Beans, Cejam, Supera Farma, Vivo e Giraffas).
- No final, o formulário é HTML real posicionado sobre o painel da placa 3D em telas largas; no celular ele vira um painel fixo abaixo da placa.
- `BRIEF.md`: o conceito, a curva de sentimento e a fonte dos números.

## Antes de publicar
- **Formulário:** hoje ele só valida os campos e mostra a confirmação. Preencha `ENDPOINT` em `js/world.js` com a URL do CRM (RD, HubSpot, Salesforce etc.).
- **Case Omega 2011:** a base classifica o cliente como "Construção Civil", mas o perfil é de segurança patrimonial. Confirme a classificação e a autorização de uso do nome.
- **Logos de clientes:** confirme a autorização de uso de marca de cada um.
- **Three.js** vem do jsDelivr (versão fixa 0.160.0). Para não depender de CDN, baixe o pacote e ajuste o `importmap`.
- As telas do app (trilha, checklist, comunicado) são ilustrativas, com nomes fictícios ("Residencial Aurora", "Edifício Atlântico").
