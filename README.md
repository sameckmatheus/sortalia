# Sortalia

Sorteador corporativo com importação de participantes e prêmios em XLSX,
CSV e TXT, fotos dos prêmios, histórico e comprovante em PDF.

Site: https://sortalia.vercel.app

## Executar

Abra `Sortalia.html` em um navegador atualizado. O projeto usa HTML,
CSS e JavaScript e não precisa de instalação ou compilação.

Os dados do sorteio ficam no armazenamento local do navegador. Utilize
o botão **Backup da base** para salvar participantes, prêmios e resultados.

## Publicar na Vercel

Importe este repositório na Vercel com as seguintes configurações:

- Framework: **Other**.
- Build Command: vazio.
- Install Command: vazio.
- Output Directory: `.`.
- Production Branch: a branch padrão do repositório.

O arquivo `vercel.json` configura a página principal para `Sortalia.html`.
O arquivo `.vercelignore` exclui backups e metadados locais do deploy.

O modelo XLSX e os demais exemplos estão na pasta `assets/`. Para detalhes
de preenchimento e uso, consulte `assets/LEIA-ME.txt`.
