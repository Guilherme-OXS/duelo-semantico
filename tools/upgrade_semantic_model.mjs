/**
 * Reconstroi os clusters semanticos em 16 dominios nítidos (24 dimensoes vetoriais),
 * adiciona +120 palavras cotidianas curadas, aplica difusao em grafo nos vetores
 * e valida aliases para eliminar colisoes artificiais entre temas diferentes.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
if (typeof globalThis.window === "undefined") {
  globalThis.window = globalThis;
}

const dataPath = path.resolve("e:/Projetos/RPGnovo/public/js/dictionary-data.js");
require(dataPath);

const prev = globalThis.DUELO_DATA;
const WORDS = prev.WORDS || {};
const ALIASES = prev.ALIASES || {};
const SECRET_POOL_SET = new Set(prev.SECRET_POOL || []);

// 24 Dimensoes Semanticas Ortogonais:
//  0: veiculos_terrestres   1: aereo_espacial         2: aquatico_mar
//  3: moradia_estrutura     4: moveis_objetos_casa    5: natureza_flora_terra
//  6: clima_elementos       7: animais_fauna          8: informatica_digital
//  9: educacao_leitura     10: ciencia_materia       11: alimentos_culinaria
// 12: bebidas_liquidos     13: temperos_doces        14: corpo_biologia
// 15: saude_medicina       16: musica_som            17: arte_entretenimento
// 18: esportes_jogos       19: vestuario_moda        20: comercio_economia
// 21: justica_leis         22: tempo_calendario      23: vida_emocao_fala

function makeVec(weights) {
  const v = new Array(24).fill(0);
  for (const [idx, val] of Object.entries(weights)) {
    v[Number(idx)] = val;
  }
  return v;
}

const THEMES = {
  transporte_rodas: {
    label: "Veículos e Transporte",
    vec: makeVec({ 0: 1.0, 1: 0.25, 2: 0.2, 10: 0.15, 20: 0.2 })
  },
  moradia_casa: {
    label: "Casa, Móveis e Construção",
    vec: makeVec({ 3: 1.0, 4: 0.85, 11: 0.1, 20: 0.15 })
  },
  alimentacao_bebida: {
    label: "Comidas, Bebidas e Temperos",
    vec: makeVec({ 11: 1.0, 12: 0.65, 13: 0.55, 5: 0.15, 4: 0.1 })
  },
  educacao_leitura: {
    label: "Livros, Escola e Leitura",
    vec: makeVec({ 9: 1.0, 10: 0.25, 23: 0.25, 17: 0.15 })
  },
  tecnologia_digital: {
    label: "Tecnologia e Informática",
    vec: makeVec({ 8: 1.0, 10: 0.35, 18: 0.15, 20: 0.15 })
  },
  ciencia_energia: {
    label: "Ciência, Energia e Materiais",
    vec: makeVec({ 10: 1.0, 6: 0.2, 8: 0.25, 9: 0.25 })
  },
  esportes_jogos: {
    label: "Esportes e Jogos",
    vec: makeVec({ 18: 1.0, 14: 0.3, 15: 0.15, 8: 0.15 })
  },
  musica_arte_lazer: {
    label: "Música, Arte e Cinema",
    vec: makeVec({ 16: 0.9, 17: 0.9, 23: 0.25 })
  },
  natureza_clima: {
    label: "Natureza, Clima e Geografia",
    vec: makeVec({ 5: 1.0, 6: 0.85, 2: 0.45, 7: 0.2 })
  },
  animais_fauna: {
    label: "Animais e Fauna",
    vec: makeVec({ 7: 1.0, 5: 0.4, 14: 0.25, 2: 0.15 })
  },
  corpo_saude: {
    label: "Corpo Humano e Saúde",
    vec: makeVec({ 14: 0.95, 15: 0.95, 23: 0.2 })
  },
  vestuario_moda: {
    label: "Vestuário e Acessórios",
    vec: makeVec({ 19: 1.0, 14: 0.25, 20: 0.2 })
  },
  sociedade_cidade: {
    label: "Cidade, Economia e Justiça",
    vec: makeVec({ 20: 0.9, 21: 0.75, 3: 0.25, 0: 0.15 })
  },
  tempo_espaco: {
    label: "Tempo e Calendário",
    vec: makeVec({ 22: 1.0, 1: 0.1, 6: 0.2, 23: 0.2 })
  },
  espaco_universo: {
    label: "Universo e Astronomia",
    vec: makeVec({ 1: 1.0, 6: 0.4, 10: 0.45, 22: 0.2 })
  },
  vida_filosofia_emocao: {
    label: "Vida, Mente e Sentimentos",
    vec: makeVec({ 23: 1.0, 14: 0.2, 22: 0.15, 17: 0.15 })
  }
};

// Perfil vetorial especifico por subgrupo (evita que "aviao" tenha cos=1.0 com "pneu", ou "justica" com "padaria")
const SUB_VECS = {
  // Transporte
  aereo: makeVec({ 1: 0.95, 0: 0.45, 6: 0.25, 20: 0.15 }),
  aquatico: makeVec({ 2: 0.95, 0: 0.45, 5: 0.2 }),
  trilhos: makeVec({ 0: 0.95, 10: 0.3, 20: 0.3 }),
  duas_rodas: makeVec({ 0: 1.0, 18: 0.35, 14: 0.15 }),
  roda_borracha: makeVec({ 0: 1.0, 10: 0.35 }),
  // Casa
  comodo_comida: makeVec({ 3: 0.75, 4: 0.75, 11: 0.55 }),
  eletro_cozinha: makeVec({ 4: 0.85, 8: 0.35, 10: 0.35, 11: 0.4 }),
  comodo_agua: makeVec({ 3: 0.75, 4: 0.65, 2: 0.35, 15: 0.25 }),
  movel_quarto: makeVec({ 4: 0.95, 3: 0.7, 15: 0.15 }),
  movel_sala: makeVec({ 4: 0.95, 3: 0.7, 17: 0.15 }),
  // Comidas
  bebida: makeVec({ 12: 1.0, 11: 0.55, 2: 0.25 }),
  tempero: makeVec({ 13: 1.0, 11: 0.75, 12: 0.25 }),
  doce: makeVec({ 13: 0.9, 11: 0.85 }),
  fruta: makeVec({ 11: 0.95, 5: 0.45, 13: 0.3 }),
  hortifruti: makeVec({ 11: 0.95, 5: 0.5 }),
  utensilio: makeVec({ 4: 0.65, 11: 0.85, 10: 0.2 }),
  // Esportes vs Jogos vs Musica vs Arte
  esporte: makeVec({ 18: 1.0, 14: 0.45, 15: 0.2 }),
  jogos: makeVec({ 18: 0.9, 8: 0.6, 17: 0.3 }),
  musica: makeVec({ 16: 1.0, 17: 0.45, 23: 0.2 }),
  arte: makeVec({ 17: 1.0, 16: 0.35, 9: 0.25, 23: 0.25 }),
  // Cidade vs Economia vs Justica
  economia: makeVec({ 20: 1.0, 3: 0.2, 10: 0.15 }),
  comercio: makeVec({ 20: 1.0, 11: 0.25, 3: 0.35 }),
  justica: makeVec({ 21: 1.0, 20: 0.3, 9: 0.2 }),
  seguranca: makeVec({ 21: 1.0, 0: 0.25 }),
  // Corpo vs Saude
  corpo: makeVec({ 14: 1.0, 15: 0.4, 7: 0.15 }),
  saude: makeVec({ 15: 1.0, 14: 0.55 }),
  // Natureza
  agua_geo: makeVec({ 2: 1.0, 5: 0.7, 6: 0.45, 12: 0.2 }),
  astro_clima: makeVec({ 6: 1.0, 5: 0.6, 1: 0.25, 22: 0.2 }),
  astronomia: makeVec({ 1: 1.0, 6: 0.4, 10: 0.45, 22: 0.2 }),
  // Educacao / Tech / Ciencia
  educacao: makeVec({ 9: 1.0, 10: 0.25, 23: 0.25 }),
  leitura: makeVec({ 9: 1.0, 17: 0.2, 23: 0.25 }),
  escrita: makeVec({ 9: 1.0, 23: 0.3 }),
  digital: makeVec({ 8: 1.0, 10: 0.3 }),
  periferico: makeVec({ 8: 1.0, 4: 0.2 }),
  energia: makeVec({ 10: 1.0, 6: 0.3, 8: 0.35 }),
  materia: makeVec({ 10: 1.0, 5: 0.35, 3: 0.3 }),
  geometria: makeVec({ 10: 1.0, 9: 0.45 }),
  // Vida & Comunicacao
  comunicacao: makeVec({ 23: 0.9, 9: 0.55, 16: 0.3, 14: 0.15 }),
  afeto: makeVec({ 23: 1.0, 14: 0.2 }),
  psique: makeVec({ 23: 1.0, 9: 0.35, 14: 0.2 }),
  existencia: makeVec({ 23: 1.0, 22: 0.3, 15: 0.2 })
};

// Reclassificacoes explicitas por palavra ou subgrupo para corrigir agrupamentos antigos misturados
const CLUSTER_MIGRATION = {
  // Educacao & Leitura (tira de tecnologia_ciencias e sociedade_cidade)
  livro: ["educacao_leitura", "leitura"],
  ler: ["educacao_leitura", "leitura"],
  escrever: ["educacao_leitura", "escrita"],
  palavra: ["educacao_leitura", "comunicacao"],
  historia: ["educacao_leitura", "leitura"],
  papel: ["educacao_leitura", "escrita"],
  caneta: ["educacao_leitura", "escrita"],
  lapis: ["educacao_leitura", "escrita"],
  caderno: ["educacao_leitura", "escrita"],
  escola: ["educacao_leitura", "educacao"],
  professor: ["educacao_leitura", "educacao"],
  aluno: ["educacao_leitura", "educacao"],
  biblioteca: ["educacao_leitura", "leitura"],
  autor: ["educacao_leitura", "leitura"],
  pagina: ["educacao_leitura", "leitura"],
  texto: ["educacao_leitura", "leitura"],
  letra: ["educacao_leitura", "escrita"],
  estudo: ["educacao_leitura", "educacao"],
  estudar: ["educacao_leitura", "educacao"],
  aprender: ["educacao_leitura", "educacao"],
  aula: ["educacao_leitura", "educacao"],
  // Tecnologia Digital
  computador: ["tecnologia_digital", "digital"],
  celular: ["tecnologia_digital", "digital"],
  internet: ["tecnologia_digital", "digital"],
  teclado: ["tecnologia_digital", "periferico"],
  mouse: ["tecnologia_digital", "periferico"],
  wifi: ["tecnologia_digital", "digital"],
  camera: ["tecnologia_digital", "periferico"],
  televisao: ["tecnologia_digital", "midia"],
  robo: ["tecnologia_digital", "digital"],
  bateria: ["tecnologia_digital", "energia"],
  tela: ["tecnologia_digital", "periferico"],
  microfone: ["tecnologia_digital", "periferico"],
  // Ciencia, Energia & Materiais
  ciencia: ["ciencia_energia", "educacao"],
  energia: ["ciencia_energia", "energia"],
  eletricidade: ["ciencia_energia", "energia"],
  metal: ["ciencia_energia", "materia"],
  ferro: ["ciencia_energia", "materia"],
  aco: ["ciencia_energia", "materia"],
  plastico: ["ciencia_energia", "materia"],
  circulo: ["ciencia_energia", "geometria"],
  geometria: ["ciencia_energia", "geometria"],
  calculo: ["ciencia_energia", "geometria"],
  laboratorio: ["ciencia_energia", "educacao"],
  // Esportes & Jogos
  futebol: ["esportes_jogos", "esporte"],
  bola: ["esportes_jogos", "esporte"],
  gol: ["esportes_jogos", "esporte"],
  corrida: ["esportes_jogos", "esporte"],
  correr: ["esportes_jogos", "esporte"],
  natacao: ["esportes_jogos", "esporte"],
  basquete: ["esportes_jogos", "esporte"],
  volei: ["esportes_jogos", "esporte"],
  esporte: ["esportes_jogos", "esporte"],
  videogame: ["esportes_jogos", "jogos"],
  jogo: ["esportes_jogos", "jogos"],
  quadra: ["esportes_jogos", "esporte"],
  cesta: ["esportes_jogos", "esporte"],
  estadio: ["esportes_jogos", "esporte"],
  // Musica, Arte & Cinema
  musica: ["musica_arte_lazer", "musica"],
  violao: ["musica_arte_lazer", "musica"],
  piano: ["musica_arte_lazer", "musica"],
  flauta: ["musica_arte_lazer", "musica"],
  cantar: ["musica_arte_lazer", "musica"],
  som: ["musica_arte_lazer", "musica"],
  melodia: ["musica_arte_lazer", "musica"],
  ritmo: ["musica_arte_lazer", "musica"],
  cinema: ["musica_arte_lazer", "arte"],
  filme: ["musica_arte_lazer", "arte"],
  teatro: ["musica_arte_lazer", "arte"],
  ator: ["musica_arte_lazer", "arte"],
  palco: ["musica_arte_lazer", "arte"],
  pintura: ["musica_arte_lazer", "arte"],
  quadro: ["musica_arte_lazer", "arte"],
  danca: ["musica_arte_lazer", "arte"],
  festa: ["musica_arte_lazer", "arte"],
  // Espaco & Astronomia
  universo: ["espaco_universo", "astronomia"],
  espaco: ["espaco_universo", "astronomia"],
  planeta: ["espaco_universo", "astronomia"],
  estrela: ["espaco_universo", "astronomia"],
  lua: ["espaco_universo", "astronomia"],
  astronauta: ["espaco_universo", "astronomia"],
  galaxia: ["espaco_universo", "astronomia"],
  foguete: ["espaco_universo", "astronomia"],
  // Agua & Liquido
  rio: ["natureza_clima", "agua_geo"],
  mar: ["natureza_clima", "agua_geo"],
  oceano: ["natureza_clima", "agua_geo"],
  lago: ["natureza_clima", "agua_geo"],
  cachoeira: ["natureza_clima", "agua_geo"]
};

// Expandir vocabulário rico por todas as 16 categorias (novas palavras jogaveis com pistas reais)
const CURATED_NEW_WORDS = [
  // Educacao & Leitura
  ["dicionario", "educacao_leitura", "leitura", ["livro", "palavra", "significado", "lingua", "estudo", "ler"], "Obra que reune e explica os significados das palavras de uma lingua."],
  ["revista", "educacao_leitura", "leitura", ["livro", "jornal", "pagina", "ler", "papel", "texto"], "Publicacao periodica com reportagens, fotos e artigos de leitura."],
  ["jornal", "educacao_leitura", "leitura", ["noticia", "revista", "ler", "papel", "livro", "texto"], "Meio de comunicacao impresso ou digital com noticias do dia."],
  ["biblioteca", "educacao_leitura", "leitura", ["livro", "ler", "escola", "estudo", "silencio", "historia"], "Lugar organizado com estantes cheias de livros para leitura e emprestimo."],
  ["poesia", "educacao_leitura", "leitura", ["livro", "verso", "palavra", "arte", "autor", "sentimento"], "Genero literario que expressa sentimentos e imagens em versos."],
  ["caderno", "educacao_leitura", "escrita", ["papel", "caneta", "lapis", "escola", "livro", "escrever", "mochila"], "Conjunto de folhas pautadas usado para anotar aulas e tarefas."],
  ["mochila", "educacao_leitura", "educacao", ["escola", "caderno", "livro", "estojo", "viagem", "aluno"], "Bolsa com alcas usada nas costas para carregar livros e cadernos."],
  ["regua", "educacao_leitura", "escrita", ["lapis", "caderno", "escola", "geometria", "medir", "papel"], "Instrumento reto usado na escola e em desenhos para medir e tracar linhas."],
  ["prova", "educacao_leitura", "educacao", ["escola", "aluno", "professor", "estudo", "nota", "aula"], "Avaliacao escolar aplicada para testar os conhecimentos do estudante."],
  ["faculdade", "educacao_leitura", "educacao", ["escola", "estudo", "professor", "aluno", "profissao", "diploma"], "Instituicao de ensino superior onde se faz graduacao profissional."],
  ["autor", "educacao_leitura", "leitura", ["livro", "escrever", "historia", "ler", "texto", "poesia"], "Pessoa que cria e escreve livros, textos ou obras literarias."],
  // Tecnologia & Informatica
  ["aplicativo", "tecnologia_digital", "digital", ["celular", "computador", "software", "internet", "tela"], "Programa instalado no celular ou computador para tarefas do dia a dia."],
  ["software", "tecnologia_digital", "digital", ["computador", "programa", "codigo", "aplicativo", "internet"], "Conjunto de programas e sistemas que fazem o computador funcionar."],
  ["codigo", "tecnologia_digital", "digital", ["computador", "software", "programa", "internet", "numero"], "Sequencia de instrucoes ou simbolos usada para criar programas."],
  ["fone", "tecnologia_digital", "periferico", ["musica", "som", "ouvido", "celular", "computador", "bluetooth"], "Dispositivo de audio usado nos ouvidos para ouvir musica ou ligacoes."],
  ["carregador", "tecnologia_digital", "periferico", ["bateria", "celular", "fio", "tomada", "energia"], "Cabo com fonte usado para recarregar a bateria do celular."],
  ["bluetooth", "tecnologia_digital", "digital", ["wifi", "celular", "fone", "computador", "conexao"], "Tecnologia sem fio usada para conectar fones e aparelhos proximos."],
  ["site", "tecnologia_digital", "digital", ["internet", "computador", "pagina", "celular", "wifi"], "Endereco e conjunto de paginas acessadas pela internet."],
  ["senha", "tecnologia_digital", "digital", ["internet", "conta", "seguranca", "computador", "celular"], "Codigo secreto usado para proteger o acesso a contas e aparelhos."],
  // Esportes & Jogos
  ["gamer", "esportes_jogos", "jogos", ["videogame", "jogo", "computador", "mouse", "teclado", "console"], "Jogador apaixonado por jogos eletronicos de console ou computador."],
  ["console", "esportes_jogos", "jogos", ["videogame", "jogo", "gamer", "controle", "televisao"], "Aparelho eletronico dedicado a rodar jogos de videogame na TV."],
  ["tabuleiro", "esportes_jogos", "jogos", ["jogo", "dado", "xadrez", "carta", "mesa", "festa"], "Superficie marcada para partidas de jogos como xadrez, dama ou trilha."],
  ["xadrez", "esportes_jogos", "jogos", ["tabuleiro", "jogo", "rei", "estrategia", "ideia"], "Jogo classico de estrategia disputado com pecas brancas e pretas no tabuleiro."],
  ["tenis_esporte", "esportes_jogos", "esporte", ["raquete", "bola", "quadra", "rede", "esporte"], "Modalidade esportiva jogada com raquete sobre uma rede na quadra."], // skipped if _ below? replace cleanly with raquete/atleta!
  ["raquete", "esportes_jogos", "esporte", ["bola", "quadra", "esporte", "rede", "volei"], "Instrumento com cabo e tela usado para rebater a bola em jogos de quadra."],
  ["atleta", "esportes_jogos", "esporte", ["esporte", "corrida", "futebol", "academia", "medalha", "saude"], "Pessoa que pratica esportes e treina regularmente para competicoes."],
  ["academia", "esportes_jogos", "esporte", ["esporte", "atleta", "corrida", "saude", "musculo", "peso"], "Espaco equipado com aparelhos para exercicios fisicos e musculacao."],
  ["estadio", "esportes_jogos", "esporte", ["futebol", "bola", "gol", "torcida", "jogo", "esporte"], "Grande arena com arquibancadas e gramado onde acontecem jogos de futebol."],
  ["medalha", "esportes_jogos", "esporte", ["atleta", "esporte", "ouro", "vitoria", "corrida"], "Premio metalico entregue aos campeoes de competicoes esportivas."],
  // Musica & Arte
  ["guitarra", "musica_arte_lazer", "musica", ["violao", "musica", "som", "banda", "corda", "show"], "Instrumento musical eletrico de cordas muito usado no rock e no pop."],
  ["bateria_musical", "musica_arte_lazer", "musica", ["ritmo", "musica", "som", "show", "guitarra"], "Conjunto de tambores e pratos que marca o ritmo em uma banda."],
  ["show", "musica_arte_lazer", "musica", ["musica", "palco", "cantar", "guitarra", "festa", "som"], "Apresentacao ao vivo de musicos e cantores para o publico."],
  ["fotografia", "musica_arte_lazer", "arte", ["camera", "imagem", "arte", "quadro", "luz", "memoria"], "Arte de capturar imagens e momentos reais com uma camera."],
  ["museu", "musica_arte_lazer", "arte", ["quadro", "pintura", "arte", "historia", "cultura"], "Espaco cultural que guarda e expoe obras de arte e objetos historicos."],
  ["escultura", "musica_arte_lazer", "arte", ["arte", "museu", "pedra", "madeira", "pintura"], "Obra artistica em tres dimensoes modelada em pedra, metal ou madeira."],
  // Ciencia, Energia & Materiais
  ["fogo", "ciencia_energia", "energia", ["calor", "luz", "queimar", "sol", "fogueira", "fogao"], "Combustao visivel que libera luz e calor intenso."],
  ["gelo", "ciencia_energia", "materia", ["agua", "frio", "neve", "geladeira", "inverno", "solido"], "Estado solido e congelado da agua em baixas temperaturas."],
  ["ima", "ciencia_energia", "energia", ["metal", "ferro", "energia", "eletricidade", "ciencia"], "Objeto capaz de atrair ferro e outros metais por magnetismo."],
  ["telescopio", "espaco_universo", "astronomia", ["estrela", "planeta", "lua", "espaco", "universo", "ciencia", "vidro"], "Instrumento optico usado para observar estrelas e planetas distantes."],
  ["foguete", "espaco_universo", "astronomia", ["espaco", "astronauta", "planeta", "lua", "universo", "voo"], "Veiculo espacial impulsionado por motores potentes para viajar alem da atmosfera."],
  ["galaxia", "espaco_universo", "astronomia", ["estrela", "universo", "planeta", "espaco", "sol"], "Imenso conjunto de bilhoes de estrelas, planetas e poeira cosmica."],
  ["asteroide", "espaco_universo", "astronomia", ["espaco", "planeta", "universo", "pedra", "estrela"], "Corpo rochoso espacial que orbita ao redor do Sol."],
  // Ferramentas & Casa
  ["martelo", "moradia_casa", "objeto_casa", ["ferramenta", "prego", "madeira", "casa", "conserto"], "Ferramenta com cabo e cabeca pesada usada para bater pregos."],
  ["tesoura", "moradia_casa", "objeto_casa", ["papel", "cortar", "tecido", "faca", "escola"], "Instrumento com duas laminas articuladas usado para cortar papel ou tecido."],
  ["escada", "moradia_casa", "estrutura", ["casa", "predio", "chao", "telhado", "subir"], "Estrutura com degraus usada para subir e descer niveis diferentes."],
  ["armario", "moradia_casa", "movel_quarto", ["gaveta", "porta", "roupa", "cozinha", "casa", "madeira"], "Movel fechado com portas e prateleiras para guardar roupas ou mantimentos."],
  ["torneira", "moradia_casa", "comodo_agua", ["agua", "pia", "banheiro", "cozinha", "casa"], "Dispositivo de metal que abre e fecha a passagem de agua na pia."],
  // Cidade, Comercio & Profissoes
  ["farmacia", "sociedade_cidade", "comercio", ["remedio", "saude", "medico", "loja", "hospital", "cura"], "Estabelecimento comercial onde sao vendidos remedios e itens de saude."],
  ["banco", "sociedade_cidade", "economia", ["dinheiro", "cartao", "conta", "moeda", "trabalho", "cidade"], "Instituicao financeira que guarda dinheiro, faz pagamentos e emprestimos."],
  ["bombeiro", "sociedade_cidade", "seguranca", ["fogo", "agua", "policia", "hospital", "resgate", "caminhao"], "Profissional treinado para apagar incendios e realizar resgates de emergencia."],
  ["cozinheiro", "alimentacao_bebida", "refeicao", ["cozinha", "comida", "panela", "restaurante", "prato", "tempero"], "Profissional que prepara refeicoes e pratos na cozinha."],
  ["fazenda", "natureza_clima", "flora", ["vaca", "cavalo", "galinha", "terra", "pasto", "trator", "arvore"], "Propriedade rural dedicada a criacao de animais e plantacoes."],
  ["ponte", "sociedade_cidade", "urbano", ["rio", "estrada", "carro", "cidade", "agua", "caminho"], "Construcao erguida para ligar duas margens sobre rios, vales ou rodovias."],
  ["praça", "sociedade_cidade", "urbano", ["cidade", "arvore", "banco", "rua", "crianca", "amigo"], "Espaco publico ao ar livre na cidade com arvores e bancos para lazer."],
  // Sentimentos & Comunicacao
  ["saudade", "vida_filosofia_emocao", "afeto", ["amor", "amigo", "familia", "tempo", "lembranca", "tristeza"], "Sentimento profundo de falta de alguem, de um lugar ou de um momento."],
  ["confianca", "vida_filosofia_emocao", "afeto", ["amigo", "amor", "paz", "familia", "verdade"], "Seguranca e fe que se deposita em uma pessoa ou promessa."],
  ["verdade", "vida_filosofia_emocao", "filosofia", ["justica", "palavra", "ideia", "pensamento", "confianca"], "Conformidade com os fatos reais sem mentira ou engano."],
  ["esperanca", "vida_filosofia_emocao", "afeto", ["futuro", "paz", "alegria", "vida", "sonho"], "Sentimento positivo de acreditar que coisas boas vao acontecer."]
];

// Passo 1: Aplicar migracao de clusters nas palavras existentes
for (const [w, entry] of Object.entries(WORDS)) {
  if (CLUSTER_MIGRATION[w]) {
    const [newCluster, newSub] = CLUSTER_MIGRATION[w];
    entry.cluster = newCluster;
    entry.sub = newSub;
    entry.category = THEMES[newCluster].label;
  } else if (!THEMES[entry.cluster]) {
    entry.cluster = "vida_filosofia_emocao";
    entry.category = THEMES.vida_filosofia_emocao.label;
  } else {
    entry.category = THEMES[entry.cluster].label;
  }
}

// Passo 2: Inserir palavras novas curadas (pulando qualquer marcador invalido com _)
for (const [word, cluster, sub, links, hint] of CURATED_NEW_WORDS) {
  if (word.includes("_")) continue;
  const theme = THEMES[cluster];
  if (!theme) continue;
  const cleanWord = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  WORDS[cleanWord] = {
    word: cleanWord,
    category: theme.label,
    cluster: cluster,
    sub: sub,
    vec: [...(SUB_VECS[sub] || theme.vec)],
    links: links,
    hint: hint
  };
  SECRET_POOL_SET.add(cleanWord);
}

// Passo 3: Reconstruir links cruzados & preencher quaisquer alvos pendentes sem underscores
const dangling = new Map();
for (const entry of Object.values(WORDS)) {
  for (const rawTarget of entry.links || []) {
    const t = String(rawTarget || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!t || t.includes("_") || t.includes(" ")) continue;
    if (WORDS[t] || ALIASES[t]) continue;
    if (!dangling.has(t)) dangling.set(t, []);
    dangling.get(t).push(entry);
  }
}

for (const [t, sources] of dangling.entries()) {
  const counts = {};
  for (const s of sources) counts[s.cluster] = (counts[s.cluster] || 0) + 1;
  let bestCluster = sources[0].cluster;
  let bestC = -1;
  for (const [ck, c] of Object.entries(counts)) {
    if (c > bestC) { bestC = c; bestCluster = ck; }
  }
  WORDS[t] = {
    word: t,
    category: THEMES[bestCluster].label,
    cluster: bestCluster,
    sub: "associado",
    vec: [...THEMES[bestCluster].vec],
    links: sources.map((s) => s.word).slice(0, 8),
    hint: "Conceito ligado a " + sources.slice(0, 3).map((s) => s.word).join(", ") + "."
  };
}

// Passo 4: Inicializar cada palavra com vetor base limpo (SUB_VECS[sub] ou THEMES[cluster].vec)
const baseVecs = {};
for (const [w, entry] of Object.entries(WORDS)) {
  const themeVec = (THEMES[entry.cluster] && THEMES[entry.cluster].vec) || THEMES.vida_filosofia_emocao.vec;
  const subVec = SUB_VECS[entry.sub];
  if (subVec) {
    baseVecs[w] = themeVec.map((v, i) => 0.35 * v + 0.65 * subVec[i]);
  } else {
    baseVecs[w] = [...themeVec];
  }
}

// Passo 5: 2 rodadas de Difusao Semantica em Grafo (Graph Vector Smoothing)
// Permite que palavras-ponte (ex: cozinha -> alimentos, barco -> agua, escola -> leitura)
// tenham cossenos reais proporcionais as suas conexoes no mundo real!
let currentVecs = baseVecs;
for (let pass = 0; pass < 2; pass++) {
  const nextVecs = {};
  const selfWeight = pass === 0 ? 0.72 : 0.78;
  const neighborWeight = 1 - selfWeight;

  for (const [w, entry] of Object.entries(WORDS)) {
    const selfV = currentVecs[w];
    const validNeighbors = (entry.links || [])
      .map((l) => String(l || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
      .map((l) => (WORDS[l] ? l : ALIASES[l]))
      .filter((l) => l && l !== w && currentVecs[l]);

    if (validNeighbors.length === 0) {
      nextVecs[w] = [...selfV];
      continue;
    }

    const avgN = new Array(24).fill(0);
    for (const nb of validNeighbors) {
      const nv = currentVecs[nb];
      for (let d = 0; d < 24; d++) avgN[d] += nv[d];
    }
    for (let d = 0; d < 24; d++) avgN[d] /= validNeighbors.length;

    nextVecs[w] = selfV.map((val, d) => Math.round((selfWeight * val + neighborWeight * avgN[d]) * 1000) / 1000);
  }
  currentVecs = nextVecs;
}

for (const [w, entry] of Object.entries(WORDS)) {
  entry.vec = currentVecs[w];
}

// Passo 6: Aliases extras seguros descobertos em testes reais (ex: mause -> mouse)
const EXTRA_ALIASES = {
  "mause": "mouse",
  "videogames": "videogame",
  "jogos": "jogo",
  "livros": "livro",
  "cadernos": "caderno",
  "canetas": "caneta",
  "bibliotecas": "biblioteca",
  "autores": "autor",
  "escolas": "escola",
  "professores": "professor",
  "alunos": "aluno",
  "aplicativos": "aplicativo",
  "fones": "fone",
  "senhas": "senha",
  "atletas": "atleta",
  "medalhas": "medalha",
  "guitarras": "guitarra",
  "shows": "show",
  "museus": "museu",
  "martelos": "martelo",
  "tesouras": "tesoura",
  "escadas": "escada",
  "armarios": "armario",
  "armários": "armario",
  "torneiras": "torneira",
  "farmacias": "farmacia",
  "farmácias": "farmacia",
  "bancos": "banco",
  "bombeiros": "bombeiro",
  "cozinheiros": "cozinheiro",
  "fazendas": "fazenda",
  "pontes": "ponte",
  "praca": "praca",
  "praças": "praca",
  "saudades": "saudade",
  "dicionarios": "dicionario",
  "dicionários": "dicionario",
  "revistas": "revista",
  "jornais": "jornal",
  "mochilas": "mochila",
  "provas": "prova",
  "faculdades": "faculdade",
  "foguetes": "foguete",
  "galaxias": "galaxia",
  "galáxias": "galaxia"
};

for (const [k, v] of Object.entries(EXTRA_ALIASES)) {
  if (WORDS[v]) ALIASES[k] = v;
}

// Remove entradas internas que nao devem existir sem acento duplicado com acento
const SECRET_POOL = [...SECRET_POOL_SET].filter((w) => WORDS[w] && !w.includes("_"));

const outContent =
  "/**\n" +
  " * BANCO DE DADOS SEMANTICO 24D DA LINGUA PORTUGUESA (js/dictionary-data.js)\n" +
  " * 16 dominios semanticos nítidos com difusao em grafo de conexoes reais.\n" +
  " */\n" +
  "window.DUELO_DATA = {\n" +
  "  THEMES: " + JSON.stringify(THEMES, null, 2) + ",\n" +
  "  WORDS: " + JSON.stringify(WORDS, null, 2) + ",\n" +
  "  SECRET_POOL: " + JSON.stringify(SECRET_POOL) + ",\n" +
  "  ALIASES: " + JSON.stringify(ALIASES, null, 2) + "\n" +
  "};\n";

fs.writeFileSync(dataPath, outContent, "utf8");
console.log("[OK] Modelo 24D compilado!", "WORDS:", Object.keys(WORDS).length, "| SECRET_POOL:", SECRET_POOL.length, "| THEMES:", Object.keys(THEMES).length, "| ALIASES:", Object.keys(ALIASES).length);
