# Duelo Semantico: Mais Proximo

Jogo de adivinhacao semantica da Lingua Portuguesa desenvolvido para **Guilherme Otavio**, 100% portatil com Motor Hibrido (Base Local + APIs Publicas).

---

## Como Funciona a Regra do Jogo

1. **1a Rodada (2 Palavras):** Voce escreve duas palavras em portugues (por exemplo: `casa` e `carro`). O aplicativo calcula a distancia semantica de cada uma ate a **Palavra Secreta** e escolhe qual das duas esta **mais proxima**.
2. **Proximas Rodadas (Campea vs. Nova Palavra):**
   - A palavra escolhida pelo programa (ex: `CARRO`) **ja fica salva automaticamente** no lado esquerdo da arena.
   - No lado direito, voce digita **apenas mais uma palavra** (ex: `pinel` / `pneu`, `roda`, `motor`...).
   - O programa compara a palavra que ja estava la com a nova que voce digitou e mantem sempre a mais proxima, ate voce chegar na **Palavra Secreta exata (100%)**!

---

## Inteligencia Semantica & Modos

- **Base Local Expandida (350+ Conceitos Nucleares + 95 Aliases):** Cobre 12 grandes eixos da lingua portuguesa (*Veiculos*, *Casa*, *Vida/Sentimentos*, *Culinaria*, *Natureza*, *Animais*, *Corpo/Saude*, *Tecnologia*, *Esportes/Musica*, *Vestuario*, *Cidade/Profissoes*, *Tempo/Universo*).
- **Conector Automatico de APIs Publicas (Online Enrichment):** Se voce digitar qualquer palavra inedita da lingua portuguesa (ex: `astronauta`, `sushi`, `fotossintese`), o motor consulta em segundo plano a API do **Dicionario Aberto** e a **Wikipedia PT**, extrai o significado e calcula a proximidade semantica real — salvando tudo em cache local.
- **Modo Treino Livre vs. Modo Palavra do Dia:** Permite testar infinitas palavras agora mesmo ou alternar para o desafio diario deterministico (estilo Termo / Contexto).

---

## Como Executar

- **Com 1 Clique:** Execute [Iniciar-Jogo.bat](file:///e:/Projetos/RPGnovo/Iniciar-Jogo.bat) ou abra diretamente o arquivo [index.html](file:///e:/Projetos/RPGnovo/index.html) no navegador.
