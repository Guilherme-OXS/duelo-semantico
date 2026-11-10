#!/usr/bin/env python3
"""
Gerador do Super-Dicionario Semantico da Lingua Portuguesa (js/dictionary-data.js)
Gera centenas e centenas de palavras estruturadas em 16 dimensoes vetoriais,
grafos de relacoes cruzadas, pistas e aliases para aproximacao semantica.
"""
import os
import json
import math

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(BASE_DIR, "js")
os.makedirs(JS_DIR, exist_ok=True)

# 16 Dimensoes Semanticas Fundamentais:
# 0: transporte/veiculos
# 1: moradia/construcao/arquitetura
# 2: natureza/flora/geografia
# 3: animais/fauna
# 4: tecnologia/digital/eletronica
# 5: comida/bebida/culinaria
# 6: corpo/saude/medicina
# 7: arte/musica/entretenimento
# 8: esporte/jogos/fisico
# 9: economia/comercio/dinheiro
# 10: educacao/ciencia/livros
# 11: ferramentas/materia/quimica/fisica
# 12: vestuario/moda
# 13: tempo/calendario/clima
# 14: sociedade/cidade/profissoes
# 15: vida/filosofia/emocoes/abstrato

THEMES = {
    "transporte_rodas": {
        "label": "Veiculos & Rodovia",
        "vec": [1.0, 0.1, 0.0, 0.0, 0.4, 0.0, 0.0, 0.0, 0.2, 0.25, 0.1, 0.7, 0.0, 0.0, 0.45, 0.0]
    },
    "moradia_casa": {
        "label": "Casa, Construcao & Lar",
        "vec": [0.05, 1.0, 0.05, 0.0, 0.15, 0.2, 0.0, 0.05, 0.0, 0.2, 0.0, 0.6, 0.05, 0.0, 0.5, 0.1]
    },
    "vida_filosofia_emocao": {
        "label": "Vida, Mente & Sentimentos",
        "vec": [0.0, 0.1, 0.2, 0.1, 0.1, 0.05, 0.5, 0.35, 0.05, 0.0, 0.4, 0.0, 0.0, 0.3, 0.35, 1.0]
    },
    "natureza_clima": {
        "label": "Natureza, Geografia & Clima",
        "vec": [0.0, 0.05, 1.0, 0.35, 0.0, 0.15, 0.05, 0.0, 0.05, 0.0, 0.25, 0.2, 0.0, 0.75, 0.0, 0.15]
    },
    "animais_fauna": {
        "label": "Reino Animal & Fauna",
        "vec": [0.0, 0.05, 0.65, 1.0, 0.0, 0.1, 0.3, 0.0, 0.1, 0.0, 0.1, 0.0, 0.0, 0.0, 0.1, 0.1]
    },
    "alimentacao_bebida": {
        "label": "Culinaria, Alimentos & Bebidas",
        "vec": [0.0, 0.2, 0.25, 0.1, 0.0, 1.0, 0.35, 0.0, 0.0, 0.2, 0.0, 0.15, 0.0, 0.0, 0.25, 0.05]
    },
    "corpo_saude": {
        "label": "Corpo Humano & Saude",
        "vec": [0.0, 0.05, 0.1, 0.2, 0.1, 0.1, 1.0, 0.05, 0.25, 0.05, 0.2, 0.1, 0.2, 0.0, 0.3, 0.5]
    },
    "tecnologia_ciencias": {
        "label": "Tecnologia, Ciencia & Digital",
        "vec": [0.2, 0.1, 0.0, 0.0, 1.0, 0.0, 0.1, 0.2, 0.1, 0.4, 0.7, 0.5, 0.0, 0.0, 0.4, 0.15]
    },
    "esporte_musica_lazer": {
        "label": "Esportes, Musica & Lazer",
        "vec": [0.05, 0.0, 0.1, 0.05, 0.15, 0.05, 0.35, 0.95, 0.95, 0.1, 0.1, 0.15, 0.1, 0.0, 0.45, 0.3]
    },
    "vestuario_moda": {
        "label": "Vestuario & Acessorios",
        "vec": [0.0, 0.15, 0.0, 0.0, 0.05, 0.0, 0.45, 0.3, 0.1, 0.4, 0.0, 0.3, 1.0, 0.15, 0.6, 0.05]
    },
    "sociedade_cidade": {
        "label": "Sociedade, Cidade & Profissoes",
        "vec": [0.35, 0.5, 0.0, 0.0, 0.3, 0.15, 0.2, 0.2, 0.15, 0.75, 0.6, 0.35, 0.3, 0.1, 1.0, 0.25]
    },
    "tempo_espaco": {
        "label": "Tempo, Universo & Astronomia",
        "vec": [0.1, 0.0, 0.4, 0.0, 0.3, 0.0, 0.0, 0.1, 0.0, 0.05, 0.5, 0.2, 0.0, 1.0, 0.2, 0.6]
    }
}

RAW_ENTRIES = [
    # --- TRANSPORTE & RODAS ---
    ("carro", "transporte_rodas", "automovel", ["veiculo", "motor", "pneu", "roda", "volante", "estrada", "garagem", "freio", "combustivel", "farol", "porta", "banco"], "Meio de transporte de quatro rodas muito comum nas ruas."),
    ("pneu", "transporte_rodas", "roda_borracha", ["roda", "borracha", "carro", "asfalto", "aro", "calibrar", "estepe", "freio", "caminhao", "moto", "bicicleta", "oficina"], "Revestimento de borracha preta cheio de ar que fica na roda do veiculo."),
    ("roda", "transporte_rodas", "roda_borracha", ["pneu", "aro", "eixo", "carro", "bicicleta", "caminhao", "girar", "borracha", "freio", "asfalto"], "Peca circular que gira no eixo para fazer o veiculo andar."),
    ("volante", "transporte_rodas", "direcao", ["carro", "direcao", "motorista", "painel", "buzina", "curva", "caminhao", "onibus", "freio", "marcha"], "Aro circular que o motorista segura para dirigir e fazer curvas."),
    ("motor", "transporte_rodas", "mecanica", ["carro", "combustivel", "gasolina", "oleo", "oficina", "mecanico", "potencia", "capo", "caminhao", "moto", "aviao"], "Coracao mecanico que gera forca para movimentar o veiculo."),
    ("freio", "transporte_rodas", "mecanica", ["carro", "roda", "pneu", "pedal", "parar", "seguranca", "disco", "moto", "bicicleta", "volante"], "Mecanismo acionado pelo pedal para desacelerar ou parar o veiculo."),
    ("gasolina", "transporte_rodas", "combustivel", ["combustivel", "motor", "carro", "posto", "tanque", "etanol", "diesel", "oleo", "energia"], "Liquido inflamavel abastecido no posto para alimentar o motor."),
    ("combustivel", "transporte_rodas", "combustivel", ["gasolina", "diesel", "etanol", "motor", "posto", "tanque", "carro", "caminhao", "aviao"], "Substancia que queima no motor para gerar movimento."),
    ("estrada", "transporte_rodas", "via", ["asfalto", "rodovia", "carro", "caminhao", "viagem", "ponte", "pedagio", "placa", "transito", "pneu"], "Via pavimentada que liga cidades por onde viajam carros e caminhoes."),
    ("asfalto", "transporte_rodas", "via", ["estrada", "rua", "pneu", "roda", "carro", "calor", "cimento", "calcada", "transito"], "Revestimento escuro das ruas e rodovias onde o pneu toca."),
    ("garagem", "transporte_rodas", "automovel", ["carro", "casa", "portao", "estacionamento", "moto", "ferramenta", "oficina"], "Espaco coberto da casa ou predio onde se guarda o carro."),
    ("oficina", "transporte_rodas", "mecanica", ["mecanico", "carro", "motor", "pneu", "roda", "chave", "ferramenta", "oleo", "conserto"], "Local onde o mecanico conserta motores, troca oleo e alinha rodas."),
    ("caminhao", "transporte_rodas", "automovel", ["carro", "estrada", "carga", "pneu", "roda", "motor", "diesel", "motorista", "rodovia"], "Veiculo pesado de grande porte usado para transportar cargas nas estradas."),
    ("moto", "transporte_rodas", "duas_rodas", ["capacete", "duas_rodas", "pneu", "roda", "motor", "guidom", "carro", "entrega", "velocidade"], "Veiculo agil de duas rodas com motor e guidom."),
    ("bicicleta", "transporte_rodas", "duas_rodas", ["pedal", "roda", "pneu", "corrente", "guidom", "capacete", "ciclovia", "esporte"], "Veiculo de duas rodas movido a forca do pedal."),
    ("onibus", "transporte_rodas", "transporte_coletivo", ["passageiro", "ponto", "motorista", "cidade", "estrada", "roda", "pneu", "viagem"], "Veiculo grande de transporte coletivo com muitos assentos."),
    ("aviao", "transporte_rodas", "aereo", ["aeroporto", "voo", "asa", "piloto", "nuvem", "ceu", "turbina", "viagem", "passagem"], "Aeronave com asas e turbinas que transporta passageiros pelo ceu."),
    ("navio", "transporte_rodas", "aquatico", ["mar", "oceano", "porto", "barco", "ancora", "capitao", "agua", "viagem", "carga"], "Grande embarcacao que navega pelos oceanos transportando cargas ou viajantes."),
    ("barco", "transporte_rodas", "aquatico", ["mar", "rio", "agua", "remo", "vela", "peixe", "pesca", "navio", "porto"], "Embarcacao menor usada em rios, lagos e no mar."),
    ("trem", "transporte_rodas", "trilhos", ["trilho", "estacao", "vagao", "ferrovia", "metro", "passageiro", "viagem", "ferro"], "Comboio de vagoes que se desloca sobre trilhos de ferro."),
    ("metro", "transporte_rodas", "trilhos", ["trem", "estacao", "cidade", "subterraneo", "trilho", "passageiro", "transporte"], "Transporte publico ferroviario urbano subterraneo ou de superficie."),
    ("capacete", "transporte_rodas", "duas_rodas", ["moto", "bicicleta", "cabeca", "seguranca", "protecao", "piloto", "transito"], "Equipamento colocado na cabeca para proteger motociclistas e ciclistas."),
    ("semaforo", "transporte_rodas", "via", ["transito", "rua", "carro", "sinal", "vermelho", "verde", "cruzamento", "asfalto"], "Sinal luminoso de tres cores que controla o trafego nos cruzamentos."),
    ("farol", "transporte_rodas", "automovel", ["carro", "luz", "noite", "estrada", "lampada", "neblina", "mar"], "Luz dianteira do veiculo usada para iluminar a estrada a noite."),
    ("estepe", "transporte_rodas", "roda_borracha", ["pneu", "roda", "carro", "porta-malas", "borracharia", "reserva"], "Pneu extra guardado no veiculo para trocas de emergencia."),
    ("pedagio", "transporte_rodas", "via", ["estrada", "rodovia", "carro", "viagem", "tarifa", "cancela"], "Posto na rodovia onde se paga taxa para utilizacao da via."),

    # --- VIDA, FILOSOFIA, SENTIMENTOS & MENTE ---
    ("vida", "vida_filosofia_emocao", "existencia", ["nascimento", "morte", "viver", "saude", "amor", "tempo", "coracao", "alma", "destino", "esperanca", "mundo", "ser"], "O dom primordial da existencia dos seres vivos; o sopro que anima a mente e o corpo."),
    ("morte", "vida_filosofia_emocao", "existencia", ["vida", "fim", "luto", "saudade", "alma", "cemiterio", "tempo", "eterno", "descanso"], "O encerramento do ciclo vital da existencia biológica."),
    ("nascimento", "vida_filosofia_emocao", "existencia", ["vida", "bebe", "parto", "inicio", "mae", "familia", "esperanca", "aniversario"], "O comeco da vida no mundo ao sair do ventre materno."),
    ("alma", "vida_filosofia_emocao", "espiritual", ["espirito", "corpo", "coracao", "vida", "sentimento", "eterno", "paz", "fe"], "A essencia imaterial profunda que habita o interior do ser humano."),
    ("amor", "vida_filosofia_emocao", "afeto", ["carinho", "paixao", "coracao", "familia", "afeto", "uniao", "vida", "felicidade", "abraco"], "O sentimento sublime de dedicacao, afeicao e cuidado profundo por alguem."),
    ("paz", "vida_filosofia_emocao", "afeto", ["harmonia", "tranquilidade", "silencio", "alma", "guerra", "esperanca", "serenidade"], "Estado de tranquilidade, ausencia de conflitos e serenidade interior."),
    ("alegria", "vida_filosofia_emocao", "afeto", ["sorriso", "felicidade", "festa", "riso", "vida", "amor", "animacao"], "Sentimento espontaneo de jubilo e contentamento estampado no sorriso."),
    ("felicidade", "vida_filosofia_emocao", "afeto", ["alegria", "paz", "vida", "amor", "harmonia", "sonho", "plenitude"], "Estado pleno de satisfacao com a propria vida e conquistas."),
    ("tristeza", "vida_filosofia_emocao", "afeto", ["choro", "lagrima", "dor", "sofrimento", "luto", "angustia", "desanimo"], "Sentimento de pesar ou desapontamento acompanhado de lagrimas."),
    ("saudade", "vida_filosofia_emocao", "afeto", ["lembranca", "distancia", "amor", "tempo", "passado", "ausencia", "coracao"], "Sentimento tipico da lingua portuguesa pela ausencia de alguem ou de um tempo querido."),
    ("medo", "vida_filosofia_emocao", "psique", ["coragem", "perigo", "susto", "escuro", "panico", "ansiedade", "protecao"], "Reacao instintiva diante de uma ameaca real ou imaginada."),
    ("coragem", "vida_filosofia_emocao", "psique", ["medo", "forca", "heroi", "bravura", "enfrentar", "ousadia", "vontade"], "Disposicao moral e forca de vontade para enfrentar perigos e superar o medo."),
    ("esperanca", "vida_filosofia_emocao", "psique", ["fe", "futuro", "sonho", "confianca", "otimismo", "vida", "luz"], "Crenca positiva de que o futuro trara coisas boas e realizacoes."),
    ("sonho", "vida_filosofia_emocao", "psique", ["dormir", "desejo", "meta", "imaginacao", "esperanca", "noite", "futuro"], "Imagem mental durante o sono ou grande meta que desejamos realizar na vida."),
    ("tempo", "vida_filosofia_emocao", "existencia", ["relogio", "hora", "dia", "ano", "passado", "futuro", "vida", "idade", "eterno"], "A dimensao continua em que os eventos se sucedem do passado ao futuro."),
    ("liberdade", "vida_filosofia_emocao", "filosofia", ["escolha", "asas", "voar", "independencia", "direito", "vontade", "paz"], "Poder de agir segundo a propria vontade e sem aprisionamentos."),
    ("verdade", "vida_filosofia_emocao", "filosofia", ["mentira", "honestidade", "justica", "confianca", "fato", "palavra"], "Conformidade com a realidade e a honestidade dos fatos."),
    ("memoria", "vida_filosofia_emocao", "psique", ["lembranca", "passado", "cerebro", "mente", "esquecer", "saudade", "historia"], "Capacidade do cerebro de guardar experiencias e conhecimentos do passado."),
    ("amizade", "vida_filosofia_emocao", "afeto", ["amigo", "lealdade", "confianca", "carinho", "parceria", "amor", "conversa"], "Relacao fraternal de confianca e carinho entre duas pessoas."),

    # --- MORADIA, ARQUITETURA & LAR ---
    ("casa", "moradia_casa", "residencia", ["lar", "telhado", "parede", "porta", "janela", "quarto", "sala", "cozinha", "familia", "jardim", "garagem", "chave"], "Construcao feita para morar com telhado, quartos, sala e cozinha."),
    ("apartamento", "moradia_casa", "residencia", ["predio", "elevador", "condominio", "casa", "quarto", "sala", "varanda", "vizinho", "cidade"], "Moradia localizada em um andar de um edificio residencial."),
    ("telhado", "moradia_casa", "estrutura", ["telha", "casa", "chuva", "teto", "calha", "madeira", "construcao", "parede"], "Parte superior externa da casa coberta de telhas que protege da chuva."),
    ("porta", "moradia_casa", "abertura", ["chave", "fechadura", "macaneta", "casa", "quarto", "sala", "madeira", "entrar", "parede"], "Estrutura que abre e fecha na parede para permitir a entrada em um comodo."),
    ("janela", "moradia_casa", "abertura", ["vidro", "cortina", "casa", "quarto", "vento", "sol", "vista", "parede"], "Abertura na parede com vidro por onde entram a luz do sol e o vento."),
    ("chave", "moradia_casa", "abertura", ["porta", "fechadura", "cadeado", "casa", "carro", "metal", "segredo", "bolso"], "Pequeno objeto de metal dentado usado para destrancar fechaduras."),
    ("quarto", "moradia_casa", "comodo", ["cama", "travesseiro", "colchao", "dormir", "sono", "guarda-roupa", "casa", "janela", "cobertor"], "Comodo tranquilo da casa onde fica a cama para dormir."),
    ("cama", "moradia_casa", "movel_quarto", ["quarto", "colchao", "travesseiro", "lencol", "cobertor", "dormir", "sono", "descanso"], "Movel com colchao e travesseiro onde deitamos para dormir."),
    ("travesseiro", "moradia_casa", "movel_quarto", ["cama", "cabeca", "colchao", "dormir", "sono", "macio", "quarto", "fronha"], "Almofada macia onde apoiamos a cabeca ao deitar na cama."),
    ("sala", "moradia_casa", "comodo", ["sofa", "televisao", "tapete", "mesa", "casa", "familia", "visita", "poltrona", "quadro"], "Comodo social da casa onde ficam o sofa e a televisao."),
    ("sofa", "moradia_casa", "movel_sala", ["sala", "almofada", "sentar", "televisao", "descanso", "poltrona", "casa", "tecido"], "Assento estofado comprido e confortavel para varias pessoas na sala."),
    ("cozinha", "moradia_casa", "comodo_comida", ["fogao", "geladeira", "pia", "panela", "comida", "prato", "casa", "forno", "mesa"], "Comodo da casa equipado com fogao, pia e geladeira onde se prepara a comida."),
    ("fogao", "moradia_casa", "eletro_cozinha", ["cozinha", "fogo", "panela", "forno", "gas", "cozinhar", "comida", "quente"], "Aparelho da cozinha com bocas de fogo e forno para cozinhar alimentos."),
    ("geladeira", "moradia_casa", "eletro_cozinha", ["cozinha", "frio", "gelo", "comida", "leite", "agua", "congelador", "energia"], "Eletrodomestico que mantem alimentos e bebidas frios e conservados."),
    ("banheiro", "moradia_casa", "comodo_agua", ["chuveiro", "banho", "agua", "sabonete", "toalha", "espelho", "pia", "escova", "casa"], "Comodo da casa com chuveiro, pia e espelho usado para tomar banho."),
    ("chuveiro", "moradia_casa", "comodo_agua", ["banheiro", "banho", "agua", "quente", "sabonete", "shampoo", "toalha"], "Aparelho no alto do banheiro de onde cai agua para o banho."),
    ("espelho", "moradia_casa", "objeto_casa", ["vidro", "reflexo", "rosto", "banheiro", "quarto", "imagem", "olhar", "parede"], "Superficie de vidro polido que reflete a nossa propria imagem."),
    ("escada", "moradia_casa", "estrutura", ["degrau", "subir", "andar", "predio", "casa", "corrimao", "alto", "telhado"], "Sequencia de degraus usada para subir ou descer entre andares."),
    ("parede", "moradia_casa", "estrutura", ["tijolo", "cimento", "tinta", "casa", "quarto", "porta", "janela", "teto", "quadro"], "Muro vertical de tijolos e cimento que divide e sustenta os comodos."),
    ("tijolo", "moradia_casa", "estrutura", ["parede", "cimento", "obra", "construcao", "barro", "casa", "pedreiro", "muro"], "Bloco de barro cozido usado pelos pedreiros para erguer paredes."),
    ("castelo", "moradia_casa", "residencia", ["rei", "rainha", "torre", "muralha", "ponte", "historia", "palacio", "pedra"], "Fortaleza antiga com torres e muralhas onde moravam reis e nobres."),
    ("predio", "moradia_casa", "residencia", ["apartamento", "elevador", "andar", "cidade", "janela", "cimento", "arquitetura"], "Construcao alta de varios andares nas cidades."),
    ("jardim", "moradia_casa", "residencia", ["flor", "grama", "planta", "casa", "arvore", "terra", "rega"], "Espaco externo cultivado com flores, grama e plantas ao redor da casa."),
    ("mesa", "moradia_casa", "movel_sala", ["cadeira", "sala", "cozinha", "prato", "comida", "madeira", "almoco"], "Movel de tampo horizontal apoiado em pernas usado para refeicoes ou trabalho."),
    ("cadeira", "moradia_casa", "movel_sala", ["mesa", "sentar", "sofa", "sala", "madeira", "pernas"], "Assento com encosto para uma pessoa se sentar junto a mesa."),

    # --- ALIMENTOS, CULINARIA & BEBIDAS ---
    ("comida", "alimentacao_bebida", "geral", ["alimento", "fome", "prato", "cozinha", "restaurante", "almoco", "jantar", "arroz", "carne", "pao"], "Tudo aquilo que comemos para matar a fome e nutrir o corpo."),
    ("pao", "alimentacao_bebida", "padaria", ["padaria", "trigo", "farinha", "forno", "manteiga", "cafe", "queijo", "sanduiche", "comida"], "Alimento assado no forno feito de farinha de trigo, classico no cafe da manha."),
    ("cafe", "alimentacao_bebida", "bebida", ["xicara", "quente", "manha", "pao", "leite", "acucar", "energia", "grao", "agua"], "Bebida escura, quente e aromatica muito tomada de manha em uma xicara."),
    ("leite", "alimentacao_bebida", "laticinio", ["vaca", "queijo", "manteiga", "cafe", "branco", "copo", "fazenda", "bolo", "chocolate"], "Liquido branco nutritivo produzido pelas vacas e base para fazer queijo."),
    ("queijo", "alimentacao_bebida", "laticinio", ["leite", "pao", "pizza", "manteiga", "vaca", "fazenda", "lanche", "amarelo"], "Alimento solido derivado do leite, otimo derretido no pao ou na pizza."),
    ("arroz", "alimentacao_bebida", "prato_brasileiro", ["feijao", "almoco", "prato", "panela", "grao", "branco", "carne", "comida", "cozinha"], "Grao branco que faz a dupla mais famosa do almoco brasileiro junto com o feijao."),
    ("feijao", "alimentacao_bebida", "prato_brasileiro", ["arroz", "panela", "caldo", "almoco", "prato", "comida", "cozinha", "proteina"], "Grao cozido com caldo na panela de pressao, parceiro inseparavel do arroz."),
    ("carne", "alimentacao_bebida", "proteina", ["churrasco", "boi", "faca", "grelha", "fogo", "almoco", "proteina", "prato", "sal"], "Alimento rico em proteina muito assado na brasa em churrascos."),
    ("frango", "alimentacao_bebida", "proteina", ["carne", "galinha", "assado", "almoco", "cozinha", "prato", "ovo"], "Carne branca de ave muito consumida assada ou grelhada."),
    ("pizza", "alimentacao_bebida", "massas", ["queijo", "forno", "massa", "tomate", "redonda", "fatia", "restaurante", "jantar"], "Disco de massa assada no forno coberto com molho de tomate e queijo."),
    ("bolo", "alimentacao_bebida", "doce", ["festa", "aniversario", "vela", "doce", "chocolate", "forno", "farinha", "acucar", "ovo"], "Massa doce e fofa assada no forno, indispensavel em festas de aniversario."),
    ("chocolate", "alimentacao_bebida", "doce", ["cacau", "doce", "bolo", "leite", "bombom", "sobremesa", "acucar", "festa"], "Doce delicioso feito a partir das sementes de cacau."),
    ("maca", "alimentacao_bebida", "fruta", ["fruta", "arvore", "vermelha", "doce", "pomar", "banana", "laranja", "saude", "feira"], "Fruta crocante de casca vermelha ou verde que cresce em macieiras."),
    ("banana", "alimentacao_bebida", "fruta", ["fruta", "amarela", "macaco", "casca", "doce", "feira", "maca", "vitamina"], "Fruta alongada de casca amarela facil de descascar."),
    ("laranja", "alimentacao_bebida", "fruta", ["fruta", "suco", "vitamina", "arvore", "limao", "doce", "pomar", "copo"], "Fruta citrica redonda muito espremida para fazer suco natural."),
    ("agua", "alimentacao_bebida", "bebida", ["sede", "beber", "copo", "rio", "mar", "chuva", "gelo", "liquido", "vida"], "Liquido transparente e essencial para a vida que mata a nossa sede."),
    ("sorvete", "alimentacao_bebida", "doce", ["frio", "gelo", "doce", "calor", "verao", "chocolate", "casquinha", "sobremesa"], "Sobremesa gelada e cremosa perfeita para dias de calor."),
    ("panela", "alimentacao_bebida", "utensilio", ["fogao", "cozinha", "comida", "arroz", "feijao", "tampa", "fogo", "metal", "colher"], "Recipiente de metal levado ao fogao para cozinhar alimentos."),
    ("prato", "alimentacao_bebida", "utensilio", ["comida", "garfo", "faca", "colher", "mesa", "almoco", "louca", "cozinha"], "Recipiente raso onde servimos a comida na mesa."),
    ("garfo", "alimentacao_bebida", "utensilio", ["faca", "colher", "prato", "comida", "mesa", "talher", "comer"], "Talher com dentes usado junto com a faca para levar comida a boca."),
    ("faca", "alimentacao_bebida", "utensilio", ["garfo", "colher", "cortar", "carne", "pao", "cozinha", "lamina"], "Instrumento cortante com lamina de metal usado para fatiar alimentos."),
    ("suco", "alimentacao_bebida", "bebida", ["fruta", "laranja", "copo", "gelo", "beber", "vitamina", "doce"], "Bebida natural extraida de frutas espremidas com agua ou gelo."),

    # --- NATUREZA, CLIMA & GEOGRAFIA ---
    ("arvore", "natureza_clima", "flora", ["floresta", "folha", "tronco", "raiz", "galho", "madeira", "fruta", "sombra", "natureza", "passaro"], "Planta de grande porte com raiz, tronco de madeira e copa cheia de folhas."),
    ("floresta", "natureza_clima", "flora", ["arvore", "mata", "natureza", "animal", "rio", "verde", "madeira", "selva", "passaro"], "Grande extensao de terra coberta por milhares de arvores e vida selvagem."),
    ("flor", "natureza_clima", "flora", ["jardim", "petala", "perfume", "abelha", "primavera", "planta", "rosa", "cor", "natureza"], "Parte colorida e perfumada das plantas que atrai abelhas no jardim."),
    ("rio", "natureza_clima", "agua_geo", ["agua", "peixe", "ponte", "barco", "margem", "correnteza", "mar", "floresta", "natureza"], "Curso natural de agua doce que corre em direcao ao mar."),
    ("mar", "natureza_clima", "agua_geo", ["oceano", "praia", "onda", "areia", "agua", "sal", "peixe", "navio", "barco", "sol"], "Imensa massa de agua salgada com ondas que banha as praias."),
    ("praia", "natureza_clima", "agua_geo", ["mar", "areia", "sol", "onda", "verao", "ferias", "agua", "coqueiro", "banho"], "Faixa de areia a beira do mar onde as pessoas tomam sol no verao."),
    ("montanha", "natureza_clima", "relevo", ["pedra", "rocha", "alto", "pico", "neve", "escalar", "natureza", "vale", "nuvem"], "Grande elevacao natural do terreno que se ergue muito alto em direcao as nuvens."),
    ("sol", "natureza_clima", "astro_clima", ["luz", "calor", "dia", "ceu", "estrela", "verao", "praia", "energia", "amarelo"], "Estrela central do nosso sistema que ilumina o dia e aquece a Terra."),
    ("lua", "natureza_clima", "astro_clima", ["noite", "ceu", "estrela", "escuro", "prata", "espaco", "mare", "planeta"], "Satelite natural que brilha no ceu noturno ao redor da Terra."),
    ("estrela", "natureza_clima", "astro_clima", ["ceu", "noite", "lua", "sol", "universo", "espaco", "brilho", "constelacao"], "Ponto luminoso que brilha na imensidao do ceu durante a noite."),
    ("chuva", "natureza_clima", "astro_clima", ["nuvem", "agua", "guarda-chuva", "tempestade", "trovao", "raio", "ceu", "molhado", "telhado"], "Gotas de agua que caem das nuvens escuras para regar a terra."),
    ("nuvem", "natureza_clima", "astro_clima", ["ceu", "chuva", "vento", "branca", "aviao", "sol", "tempestade", "ar"], "Massa branca ou cinzenta que flutua alto no ceu e traz a chuva."),
    ("vento", "natureza_clima", "astro_clima", ["ar", "brisa", "nuvem", "folha", "tempestade", "frio", "janela", "vela"], "Ar em movimento que balanca os galhos das arvores e refresca o rosto."),
    ("fogo", "natureza_clima", "elemento", ["calor", "chama", "fumaca", "lenha", "cinza", "fogao", "incendio", "quente", "sol"], "Chama ardente que produz luz, calor e fumaca ao queimar madeira."),
    ("pedra", "natureza_clima", "elemento", ["rocha", "montanha", "terra", "duro", "areia", "rio", "castelo", "minerio"], "Material mineral solido e duro encontrado nas montanhas e no leito dos rios."),
    ("terra", "natureza_clima", "elemento", ["solo", "planta", "planeta", "barro", "arvore", "raiz", "areia"], "Solo onde as plantas criam raizes e o planeta onde habitamos."),
    ("neve", "natureza_clima", "astro_clima", ["frio", "gelo", "inverno", "branca", "montanha", "esqui", "nuvem"], "Precipitacao de cristais de gelo brancos e macios em regioes muito frias."),
    ("vulcao", "natureza_clima", "relevo", ["lava", "magma", "fogo", "montanha", "cratera", "cinza", "erupcao"], "Montanha com abertura por onde saem lava e gases incandescentes da Terra."),

    # --- ANIMAIS & FAUNA ---
    ("cachorro", "animais_fauna", "domestico", ["cao", "gato", "latido", "coleira", "osso", "amigo", "casa", "pata", "animal", "pet"], "Animal domestico leal conhecido como o melhor amigo do ser humano."),
    ("gato", "animais_fauna", "domestico", ["cachorro", "felino", "bigode", "pata", "leite", "rato", "casa", "animal", "miar"], "Felino domestico agil e independente que gosta de cacar ratos e tirar sonecas."),
    ("cavalo", "animais_fauna", "fazenda", ["fazenda", "sela", "corrida", "campo", "grama", "forte", "animal", "carroca"], "Animal veloz e elegante de quatro patas usado para cavalgar em fazendas."),
    ("vaca", "animais_fauna", "fazenda", ["leite", "boi", "fazenda", "pasto", "queijo", "carne", "campo", "animal"], "Animal de fazenda que pasta no campo e produz o leite que bebemos."),
    ("leao", "animais_fauna", "selvagem", ["selva", "juba", "rei", "rugido", "felino", "cacador", "animal", "africa", "tigre"], "Grande felino de juba imponente chamado de rei da selva."),
    ("lobo", "animais_fauna", "selvagem", ["floresta", "lua", "alcateia", "uivo", "cachorro", "noite", "cacador", "animal"], "Predador selvagem que vive em alcateia e uiva para a lua."),
    ("passaro", "animais_fauna", "ave", ["asa", "voo", "pena", "ninho", "arvore", "canto", "bico", "ceu", "aguia"], "Animal coberto de penas com bico e asas que constroi ninhos nas arvores."),
    ("aguia", "animais_fauna", "ave", ["passaro", "voo", "asa", "montanha", "visao", "bico", "garra", "ceu"], "Ave de rapina majestosa de visao agucada que voa no topo das montanhas."),
    ("peixe", "animais_fauna", "aquatico", ["agua", "mar", "rio", "nadar", "escama", "pesca", "aquario", "tubarao", "rede"], "Animal aquatico com escamas e nadadeiras que respira debaixo da agua."),
    ("tubarao", "animais_fauna", "aquatico", ["mar", "oceano", "peixe", "dente", "nadadeira", "agua", "predador", "praia"], "Grande predador marinho de dentes afiados e barbatana dorsal."),
    ("baleia", "animais_fauna", "aquatico", ["oceano", "mar", "gigante", "agua", "mamifero", "nadadeira", "peixe"], "O maior mamifero do planeta que nada nas profundezas dos oceanos."),
    ("abelha", "animais_fauna", "inseto", ["mel", "flor", "colmeia", "asa", "jardim", "inseto", "rainha", "amarelo"], "Inseto voador trabalhador que coleta nectar das flores para produzir mel."),
    ("borboleta", "animais_fauna", "inseto", ["asa", "lagarta", "flor", "cor", "jardim", "natureza", "voo"], "Inseto com asas coloridas que passa pela metamorfose a partir da lagarta."),
    ("macaco", "animais_fauna", "selvagem", ["banana", "arvore", "floresta", "selva", "galho", "selvagem", "rabo"], "Mamifero agil que pula entre os galhos das arvores da selva."),
    ("elefante", "animais_fauna", "selvagem", ["tromba", "marfim", "gigante", "orelha", "africa", "selva", "pesado"], "Enorme mamifero terrestre de orelhas grandes e tromba flexivel."),

    # --- TECNOLOGIA, CIENCIA & DIGITAL ---
    ("computador", "tecnologia_ciencias", "digital", ["teclado", "tela", "monitor", "mouse", "internet", "programa", "codigo", "notebook", "mesa", "trabalho"], "Maquina eletronica com tela e teclado usada para trabalhar, programar e navegar na internet."),
    ("celular", "tecnologia_ciencias", "digital", ["telefone", "tela", "bateria", "internet", "mensagem", "camera", "aplicativo", "bolso", "ligacao"], "Aparelho portatil de bolso com tela sensivel ao toque usado para mensagens, fotos e internet."),
    ("internet", "tecnologia_ciencias", "digital", ["rede", "computador", "celular", "site", "wifi", "mundo", "mensagem", "video", "dados"], "Rede mundial que conecta computadores e celulares em todo o planeta."),
    ("teclado", "tecnologia_ciencias", "periferico", ["computador", "letra", "digitar", "botao", "tela", "mouse", "piano", "escrever"], "Conjunto de teclas com letras e numeros usado para digitar no computador."),
    ("televisao", "tecnologia_ciencias", "midia", ["tela", "sala", "sofa", "controle", "filme", "jornal", "canal", "imagem", "som"], "Aparelho com tela grande na sala usado para assistir filmes, jogos e canais."),
    ("camera", "tecnologia_ciencias", "midia", ["foto", "imagem", "lente", "video", "filme", "celular", "memoria", "luz"], "Dispositivo com lente optica usado para registrar fotografias e videos."),
    ("bateria", "tecnologia_ciencias", "energia", ["energia", "celular", "carro", "eletricidade", "carregador", "pilha", "tomada", "forca"], "Componente que armazena energia eletrica para fazer o celular ou o carro ligar."),
    ("robo", "tecnologia_ciencias", "digital", ["maquina", "computador", "futuro", "inteligencia", "metal", "engrenagem", "automacao"], "Maquina programada para executar tarefas de forma automatica."),
    ("livro", "tecnologia_ciencias", "educacao", ["leitura", "pagina", "papel", "historia", "escola", "biblioteca", "autor", "palavra", "estudo"], "Conjunto de paginas impressas encadernadas que contem historias ou conhecimento."),
    ("escola", "tecnologia_ciencias", "educacao", ["professor", "aluno", "aula", "livro", "caderno", "lapis", "estudo", "quadro", "aprender"], "Lugar onde alunos e professores se reunem para estudar e aprender."),
    ("relogio", "tecnologia_ciencias", "tempo", ["tempo", "hora", "minuto", "ponteiro", "pulso", "parede", "despertador", "segundo"], "Instrumento usado no pulso ou na parede para marcar as horas e os minutos."),
    ("fone", "tecnologia_ciencias", "periferico", ["ouvido", "musica", "som", "celular", "computador", "audio", "fio"], "Aparelho colocado nos ouvidos para escutar musica e chamadas sem incomodar."),

    # --- ESPORTE, MUSICA & LAZER ---
    ("futebol", "esporte_musica_lazer", "esporte", ["bola", "gol", "campo", "grama", "time", "jogador", "estadio", "chuteira", "copa", "rede"], "Esporte mais popular do Brasil jogado com os pes, uma bola e duas traves de gol."),
    ("bola", "esporte_musica_lazer", "esporte", ["futebol", "gol", "redonda", "chute", "jogo", "quadra", "basquete", "volei", "brinquedo"], "Objeto esferico que rola e quica, essencial em partidas de futebol e outros esportes."),
    ("violao", "esporte_musica_lazer", "musica", ["musica", "corda", "madeira", "som", "cantar", "guitarra", "instrumento", "melodia", "dedo"], "Instrumento musical acustico de madeira com seis cordas dedilhadas."),
    ("musica", "esporte_musica_lazer", "musica", ["som", "violao", "piano", "cantar", "voz", "ritmo", "melodia", "radio", "festa"], "Arte de combinar sons, ritmos e melodias que ouvimos e cantamos."),
    ("piano", "esporte_musica_lazer", "musica", ["musica", "teclado", "tecla", "som", "concerto", "melodia", "instrumento", "violao"], "Grande instrumento musical classico de teclas brancas e pretas."),
    ("filme", "esporte_musica_lazer", "arte", ["cinema", "tela", "pipoca", "ator", "historia", "camera", "televisao", "diretor"], "Obra audiovisual contada em imagens em movimento na tela do cinema ou da TV."),
    ("jogo", "esporte_musica_lazer", "jogos", ["brincadeira", "tabuleiro", "videogame", "vitoria", "regra", "competicao", "diversao"], "Atividade com regras definida para entretenimento ou competicao."),

    # --- CORPO HUMANO & SAUDE ---
    ("coracao", "corpo_saude", "corpo", ["sangue", "peito", "vida", "amor", "batimento", "corpo", "medico", "saude"], "Orgao vital no centro do peito que bombeia sangue por todo o corpo."),
    ("mao", "corpo_saude", "corpo", ["dedo", "braco", "luva", "segurar", "escrever", "anel", "corpo", "tocar"], "Parte na extremidade do braco com cinco dedos usada para segurar objetos."),
    ("olho", "corpo_saude", "corpo", ["visao", "enxergar", "rosto", "oculos", "luz", "cor", "lagrima", "espelho"], "Orgao da visao no rosto que nos permite enxergar as cores e o mundo."),
    ("cabeca", "corpo_saude", "corpo", ["cerebro", "cabelo", "rosto", "pensar", "olho", "boca", "chapeu", "capacete"], "Parte superior do corpo onde ficam o cerebro, os olhos e o rosto."),
    ("dente", "corpo_saude", "corpo", ["boca", "sorriso", "morder", "escova", "dentista", "mastigar", "branco"], "Estrutura dura na boca usada para mastigar alimentos e sorrir."),
    ("hospital", "corpo_saude", "saude", ["medico", "saude", "remedio", "enfermeiro", "ambulancia", "cama", "vida", "cuidar"], "Centro medico onde doutores e enfermeiros cuidam da saude dos pacientes."),
    ("remedio", "corpo_saude", "saude", ["farmacia", "medico", "doenca", "cura", "saude", "pilula", "xarope"], "Substancia prescrita para curar doencas ou aliviar sintomas do corpo."),

    # --- VESTUARIO & ACESSORIOS ---
    ("sapato", "vestuario_moda", "calcado", ["pe", "tenis", "meia", "andar", "couro", "cadarco", "roupa", "sola", "borracha"], "Calcado usado nos pes para caminhar com conforto e protecao."),
    ("camisa", "vestuario_moda", "roupa", ["roupa", "tecido", "botao", "manga", "gola", "calca", "vestir", "guarda-roupa"], "Peca de roupa de tecido com mangas e botoes que veste o tronco."),
    ("calca", "vestuario_moda", "roupa", ["roupa", "perna", "jeans", "cinto", "bolso", "vestir", "sapato"], "Peca de vestuario que cobre da cintura ate os tornozelos."),
    ("oculos", "vestuario_moda", "acessorio", ["olho", "lente", "visao", "rosto", "sol", "leitura", "vidro", "armacao"], "Acessorio com duas lentes apoiado no rosto para melhorar a visao ou proteger do sol."),
    ("chapeu", "vestuario_moda", "acessorio", ["cabeca", "sol", "bone", "aba", "vestir", "sombra"], "Acessorio usado na cabeca para protecao do sol ou adorno."),

    # --- SOCIEDADE, CIDADE & PROFISSOES ---
    ("cidade", "sociedade_cidade", "urbano", ["rua", "predio", "casa", "carro", "pessoa", "loja", "praca", "asfalto", "transito"], "Area urbana com ruas, predios, comercios, casas e milhares de moradores."),
    ("dinheiro", "sociedade_cidade", "economia", ["moeda", "banco", "compra", "loja", "trabalho", "ouro", "carteira", "bolso", "preco"], "Recurso em notas, moedas ou saldo usado para comprar produtos e pagar servicos."),
    ("escola", "sociedade_cidade", "educacao", ["professor", "aluno", "livro", "aula", "aprender", "sala", "estudo"], "Instituicao dedicada ao ensino e formacao de criancas e jovens."),
    ("policia", "sociedade_cidade", "seguranca", ["seguranca", "lei", "delegacia", "viatura", "crime", "ordem", "farda"], "Forca publica responsavel pela manutencao da ordem e seguranca da populacao."),
    ("trabalho", "sociedade_cidade", "profissao", ["emprego", "salario", "dinheiro", "empresa", "profissao", "esforco", "dia"], "Atividade produtiva que o ser humano exerce para seu sustento.")
]

# Aliases foneticos, ortograficos e sinônimos
ALIASES = {
    "pinel": "pneu",
    "pineu": "pneu",
    "pneus": "pneu",
    "rodas": "roda",
    "carros": "carro",
    "auto": "carro",
    "automovel": "carro",
    "automóvel": "carro",
    "casas": "casa",
    "caza": "casa",
    "lar": "casa",
    "residencia": "casa",
    "motocicleta": "moto",
    "bike": "bicicleta",
    "camiao": "caminhao",
    "caminhão": "caminhao",
    "ônibus": "onibus",
    "avião": "aviao",
    "aeronave": "aviao",
    "barcos": "barco",
    "navios": "navio",
    "combustível": "combustivel",
    "álcool": "etanol",
    "alcool": "etanol",
    "mecânico": "mecanico",
    "direção": "volante",
    "direcao": "volante",
    "guiador": "volante",
    "portas": "porta",
    "janelas": "janela",
    "chaves": "chave",
    "quartos": "quarto",
    "camas": "cama",
    "colchão": "colchao",
    "sofá": "sofa",
    "fogão": "fogao",
    "refrigerador": "geladeira",
    "geladera": "geladeira",
    "chuvero": "chuveiro",
    "prédio": "predio",
    "edifício": "predio",
    "edificio": "predio",
    "pão": "pao",
    "paes": "pao",
    "café": "cafe",
    "feijão": "feijao",
    "maçã": "maca",
    "maca": "maca",
    "água": "agua",
    "açúcar": "acucar",
    "árvore": "arvore",
    "arvores": "arvore",
    "flores": "flor",
    "montanhas": "montanha",
    "estrelas": "estrela",
    "cão": "cachorro",
    "cao": "cachorro",
    "cachorros": "cachorro",
    "gatos": "gato",
    "leão": "leao",
    "pássaro": "passaro",
    "passaros": "passaro",
    "ave": "passaro",
    "águia": "aguia",
    "peixes": "peixe",
    "tubarão": "tubarao",
    "abelhas": "abelha",
    "pc": "computador",
    "notebook": "computador",
    "telefone": "celular",
    "smartphone": "celular",
    "tv": "televisao",
    "televisão": "televisao",
    "câmera": "camera",
    "robô": "robo",
    "livros": "livro",
    "relógio": "relogio",
    "violão": "violao",
    "guitarra": "violao",
    "música": "musica",
    "coração": "coracao",
    "mão": "mao",
    "olhos": "olho",
    "óculos": "oculos",
    "tênis": "sapato",
    "tenis": "sapato",
    "calcado": "sapato",
    "calçado": "sapato",
    "roupa": "camisa",
    "medico": "hospital",
    "médico": "hospital",
    "remedios": "remedio",
    "remédio": "remedio",
    "calças": "calca",
    "calca": "calca"
}

# Expandir vocabulário geral com palavras comuns da lingua portuguesa (para cobrir milhares de palavras)
EXTENDED_VOCABULARY = [
    # Animais
    ("touro", "animais_fauna", "fazenda", ["vaca", "boi", "chifre", "pasto"]),
    ("bezerro", "animais_fauna", "fazenda", ["vaca", "leite", "fazenda"]),
    ("carneiro", "animais_fauna", "fazenda", ["ovelha", "la", "fazenda"]),
    ("ovelha", "animais_fauna", "fazenda", ["carneiro", "la", "pastor"]),
    ("porco", "animais_fauna", "fazenda", ["lama", "fazenda", "bacon"]),
    ("galinha", "animais_fauna", "fazenda", ["ovo", "galo", "frango"]),
    ("galo", "animais_fauna", "fazenda", ["galinha", "manha", "canto"]),
    ("pato", "animais_fauna", "ave", ["lago", "pena", "bico"]),
    ("coruja", "animais_fauna", "ave", ["noite", "olhos", "arvore"]),
    ("tigre", "animais_fauna", "selvagem", ["leao", "felino", "listras"]),
    ("onca", "animais_fauna", "selvagem", ["floresta", "felino", "selva"]),
    ("urso", "animais_fauna", "selvagem", ["floresta", "mel", "inverno"]),
    ("golfinho", "animais_fauna", "aquatico", ["mar", "oceano", "inteligencia"]),
    ("tartaruga", "animais_fauna", "aquatico", ["casco", "mar", "lenta"]),
    ("cobra", "animais_fauna", "selvagem", ["veneno", "bote", "rastejar"]),
    ("sapo", "animais_fauna", "selvagem", ["lago", "pular", "verde"]),
    ("formiga", "animais_fauna", "inseto", ["acucar", "trabalho", "formigueiro"]),
    # Comidas & Bebidas
    ("tomate", "alimentacao_bebida", "hortifruti", ["salada", "vermelho", "pizza"]),
    ("alface", "alimentacao_bebida", "hortifruti", ["salada", "verde", "prato"]),
    ("cenoura", "alimentacao_bebida", "hortifruti", ["laranja", "coelho", "salada"]),
    ("cebola", "alimentacao_bebida", "hortifruti", ["tempero", "panela", "cozinha"]),
    ("alho", "alimentacao_bebida", "hortifruti", ["tempero", "cebola", "panela"]),
    ("uva", "alimentacao_bebida", "fruta", ["vinho", "doce", "fruta"]),
    ("morango", "alimentacao_bebida", "fruta", ["vermelho", "doce", "bolo"]),
    ("abacaxi", "alimentacao_bebida", "fruta", ["coroa", "amarelo", "suco"]),
    ("melancia", "alimentacao_bebida", "fruta", ["verde", "vermelha", "agua"]),
    ("manga", "alimentacao_bebida", "fruta", ["doce", "amarela", "suco"]),
    ("limao", "alimentacao_bebida", "fruta", ["azedo", "suco", "verde"]),
    ("azeite", "alimentacao_bebida", "tempero", ["oliva", "salada", "cozinha"]),
    ("pimenta", "alimentacao_bebida", "tempero", ["ardida", "tempero", "comida"]),
    ("sal", "alimentacao_bebida", "tempero", ["comida", "mar", "panela"]),
    ("acucar", "alimentacao_bebida", "doce", ["doce", "cafe", "bolo"]),
    ("vinho", "alimentacao_bebida", "bebida", ["uva", "taca", "garrafa"]),
    ("cerveja", "alimentacao_bebida", "bebida", ["copo", "bar", "festa"]),
    ("cha", "alimentacao_bebida", "bebida", ["quente", "xicara", "erva"]),
    ("batata", "alimentacao_bebida", "hortifruti", ["frita", "pure", "comida"]),
    ("hamburguer", "alimentacao_bebida", "lanche", ["pao", "carne", "queijo"]),
    ("sanduiche", "alimentacao_bebida", "lanche", ["pao", "queijo", "lanche"]),
    ("torta", "alimentacao_bebida", "doce", ["bolo", "forno", "doce"]),
    ("biscoito", "alimentacao_bebida", "doce", ["cafe", "doce", "crocante"]),
    ("pipoca", "alimentacao_bebida", "lanche", ["milho", "cinema", "panela"]),
    # Casa & Moveis
    ("tapete", "moradia_casa", "movel_sala", ["chao", "sala", "tecido"]),
    ("cortina", "moradia_casa", "abertura", ["janela", "tecido", "sala"]),
    ("poltrona", "moradia_casa", "movel_sala", ["sofa", "sentar", "sala"]),
    ("guarda-roupa", "moradia_casa", "movel_quarto", ["roupa", "quarto", "camisa"]),
    ("gaveta", "moradia_casa", "movel_quarto", ["armario", "guardar", "quarto"]),
    ("quadro", "moradia_casa", "objeto_casa", ["parede", "pintura", "arte"]),
    ("abajur", "moradia_casa", "objeto_casa", ["luz", "quarto", "noite"]),
    ("toalha", "moradia_casa", "comodo_agua", ["banheiro", "banho", "secar"]),
    ("sabonete", "moradia_casa", "comodo_agua", ["banho", "cheiro", "banheiro"]),
    ("shampoo", "moradia_casa", "comodo_agua", ["cabelo", "banho", "banheiro"]),
    ("escova", "moradia_casa", "comodo_agua", ["dente", "cabelo", "banheiro"]),
    ("piscina", "moradia_casa", "residencia", ["agua", "nadar", "verao"]),
    ("churrasqueira", "moradia_casa", "residencia", ["churrasco", "carne", "fogo"]),
    # Roupas
    ("bermuda", "vestuario_moda", "roupa", ["calca", "perna", "verao"]),
    ("vestido", "vestuario_moda", "roupa", ["festa", "mulher", "tecido"]),
    ("saia", "vestuario_moda", "roupa", ["vestido", "tecido", "perna"]),
    ("casaco", "vestuario_moda", "roupa", ["frio", "inverno", "la"]),
    ("jaqueta", "vestuario_moda", "roupa", ["casaco", "couro", "frio"]),
    ("bota", "vestuario_moda", "calcado", ["sapato", "couro", "pe"]),
    ("sandalia", "vestuario_moda", "calcado", ["chinelo", "pe", "verao"]),
    ("chinelo", "vestuario_moda", "calcado", ["praia", "pe", "casa"]),
    ("meia", "vestuario_moda", "calcado", ["pe", "sapato", "tenis"]),
    ("cinto", "vestuario_moda", "acessorio", ["calca", "couro", "cintura"]),
    ("bone", "vestuario_moda", "acessorio", ["chapeu", "cabeca", "sol"]),
    ("anel", "vestuario_moda", "acessorio", ["dedo", "ouro", "joia"]),
    ("colar", "vestuario_moda", "acessorio", ["pescoco", "ouro", "joia"]),
    ("brinco", "vestuario_moda", "acessorio", ["orelha", "joia", "ouro"]),
    ("mochila", "vestuario_moda", "acessorio", ["escola", "costas", "bolsa"]),
    ("bolsa", "vestuario_moda", "acessorio", ["mochila", "carteira", "guardar"]),
    # Corpo & Saude
    ("cabelo", "corpo_saude", "corpo", ["cabeca", "pente", "cortar"]),
    ("nariz", "corpo_saude", "corpo", ["rosto", "cheiro", "respirar"]),
    ("boca", "corpo_saude", "corpo", ["dente", "lingua", "falar", "comer"]),
    ("lingua", "corpo_saude", "corpo", ["boca", "gosto", "falar"]),
    ("orelha", "corpo_saude", "corpo", ["ouvir", "som", "brinco"]),
    ("pescoco", "corpo_saude", "corpo", ["cabeca", "garganta", "colar"]),
    ("braco", "corpo_saude", "corpo", ["mao", "ombro", "forca"]),
    ("perna", "corpo_saude", "corpo", ["pe", "joelho", "andar", "correr"]),
    ("joelho", "corpo_saude", "corpo", ["perna", "dobrar", "articulacao"]),
    ("pe", "corpo_saude", "corpo", ["sapato", "dedo", "andar", "chute"]),
    ("cerebro", "corpo_saude", "corpo", ["mente", "pensar", "cabeca"]),
    ("sangue", "corpo_saude", "corpo", ["coracao", "vermelho", "veia"]),
    ("osso", "corpo_saude", "corpo", ["esqueleto", "duro", "corpo"]),
    ("pele", "corpo_saude", "corpo", ["tato", "corpo", "proteger"]),
    ("medico", "corpo_saude", "saude", ["hospital", "doutor", "saude", "remedio"]),
    ("dentista", "corpo_saude", "saude", ["dente", "boca", "consultorio"]),
    ("farmacia", "corpo_saude", "saude", ["remedio", "remedios", "saude"]),
    # Sociedade, Cidade, Profissoes
    ("professor", "sociedade_cidade", "educacao", ["aluno", "escola", "ensinar", "aula"]),
    ("aluno", "sociedade_cidade", "educacao", ["professor", "escola", "estudar"]),
    ("advogado", "sociedade_cidade", "justica", ["lei", "juiz", "tribunal"]),
    ("juiz", "sociedade_cidade", "justica", ["tribunal", "lei", "justica"]),
    ("bombeiro", "sociedade_cidade", "seguranca", ["fogo", "agua", "incendio", "salvar"]),
    ("engenheiro", "sociedade_cidade", "profissao", ["obra", "projeto", "predio"]),
    ("motorista", "sociedade_cidade", "profissao", ["carro", "onibus", "caminhao", "estrada"]),
    ("banco", "sociedade_cidade", "economia", ["dinheiro", "conta", "cartao"]),
    ("loja", "sociedade_cidade", "comercio", ["compra", "venda", "preco", "produto"]),
    ("mercado", "sociedade_cidade", "comercio", ["comida", "compras", "feira"]),
    ("shopping", "sociedade_cidade", "comercio", ["lojas", "cinema", "compras"]),
    ("igreja", "sociedade_cidade", "religiao", ["fe", "oracao", "templo", "deus"]),
    ("praca", "sociedade_cidade", "urbano", ["banco", "arvore", "cidade", "passeio"]),
    ("avenida", "sociedade_cidade", "urbano", ["rua", "carro", "cidade", "asfalto"]),
    ("calcada", "sociedade_cidade", "urbano", ["rua", "pedestre", "andar"]),
    ("ponte", "sociedade_cidade", "urbano", ["rio", "estrada", "atravessar"]),
    # Tempo & Universo
    ("segundo", "tempo_espaco", "unidade", ["minuto", "hora", "relogio"]),
    ("minuto", "tempo_espaco", "unidade", ["segundo", "hora", "tempo"]),
    ("hora", "tempo_espaco", "unidade", ["relogio", "minuto", "dia"]),
    ("dia", "tempo_espaco", "calendario", ["sol", "luz", "manha", "noite"]),
    ("noite", "tempo_espaco", "calendario", ["lua", "escuro", "estrela", "sono"]),
    ("manha", "tempo_espaco", "calendario", ["sol", "cafe", "dia", "acordar"]),
    ("tarde", "tempo_espaco", "calendario", ["sol", "dia", "noite"]),
    ("madrugada", "tempo_espaco", "calendario", ["noite", "escuro", "sono"]),
    ("semana", "tempo_espaco", "calendario", ["dia", "mes", "domingo"]),
    ("mes", "tempo_espaco", "calendario", ["semana", "ano", "calendario"]),
    ("ano", "tempo_espaco", "calendario", ["mes", "aniversario", "tempo"]),
    ("primavera", "tempo_espaco", "estacao", ["flor", "jardim", "estacao"]),
    ("verao", "tempo_espaco", "estacao", ["sol", "calor", "praia"]),
    ("outono", "tempo_espaco", "estacao", ["folha", "vento", "estacao"]),
    ("inverno", "tempo_espaco", "estacao", ["frio", "neve", "casaco"]),
    ("universo", "tempo_espaco", "astronomia", ["espaco", "galaxia", "estrela", "infinito"]),
    ("espaco", "tempo_espaco", "astronomia", ["universo", "planeta", "estrela", "foguete"]),
    ("galaxia", "tempo_espaco", "astronomia", ["universo", "estrela", "espaco"]),
    ("planeta", "tempo_espaco", "astronomia", ["terra", "marte", "orbita", "espaco"]),
    ("cometa", "tempo_espaco", "astronomia", ["espaco", "gelo", "rastro", "ceu"]),
    ("foguete", "tempo_espaco", "astronomia", ["espaco", "astronauta", "lua", "aviao"]),
    # Mais Objetos, Ferramentas, Instrumentos & Cotidiano
    ("martelo", "moradia_construcao_extra" if False else "sociedade_cidade", "ferramenta", ["prego", "ferramenta", "madeira", "obra"]),
    ("ferramenta", "tecnologia_ciencias", "mecanica", ["martelo", "chave", "oficina", "conserto"]),
    ("tesoura", "tecnologia_ciencias", "objeto", ["cortar", "papel", "cabelo", "tecido"]),
    ("lapis", "tecnologia_ciencias", "educacao", ["caderno", "escola", "escrever", "papel"]),
    ("caneta", "tecnologia_ciencias", "educacao", ["papel", "caderno", "escrever", "tinta"]),
    ("papel", "tecnologia_ciencias", "educacao", ["livro", "caderno", "escrever", "arvore"]),
    ("caderno", "tecnologia_ciencias", "educacao", ["escola", "livro", "lapis", "caneta"]),
    ("oculos", "vestuario_moda", "acessorio", ["olho", "visao", "rosto", "sol"]),
    ("carteira", "vestuario_moda", "acessorio", ["dinheiro", "cartao", "bolso", "documento"]),
    ("guarda-chuva", "vestuario_moda", "acessorio", ["chuva", "agua", "nuvem", "protecao"]),
    ("mala", "vestuario_moda", "acessorio", ["viagem", "aeroporto", "roupa", "ferias"]),
    ("viagem", "transporte_rodas", "via", ["aviao", "carro", "estrada", "ferias", "mala"]),
    ("ferias", "esporte_musica_lazer", "lazer", ["praia", "viagem", "descanso", "verao"]),
    ("praia", "natureza_clima", "agua_geo", ["mar", "areia", "sol", "ferias"]),
    ("guitarra", "esporte_musica_lazer", "musica", ["violao", "musica", "rock", "corda", "som"]),
    ("bateria_musica", "esporte_musica_lazer", "musica", ["musica", "ritmo", "som", "show"]),
    ("flauta", "esporte_musica_lazer", "musica", ["musica", "sopro", "som", "melodia"]),
    ("cinema", "esporte_musica_lazer", "arte", ["filme", "pipoca", "tela", "ator"]),
    ("teatro", "esporte_musica_lazer", "arte", ["palco", "ator", "arte", "filme"]),
    ("pintura", "esporte_musica_lazer", "arte", ["quadro", "tinta", "arte", "cor"]),
    ("danca", "esporte_musica_lazer", "arte", ["musica", "ritmo", "corpo", "festa"]),
    ("festa", "esporte_musica_lazer", "lazer", ["bolo", "musica", "alegria", "danca"]),
    ("natacao", "esporte_musica_lazer", "esporte", ["piscina", "agua", "esporte", "nadar"]),
    ("corrida", "esporte_musica_lazer", "esporte", ["tenis", "perna", "esporte", "velocidade"]),
    ("basquete", "esporte_musica_lazer", "esporte", ["bola", "cesta", "quadra", "esporte"]),
    ("volei", "esporte_musica_lazer", "esporte", ["bola", "rede", "praia", "quadra"]),
    ("bicicleta", "transporte_rodas", "duas_rodas", ["roda", "pneu", "pedal", "esporte"]),
    ("trator", "transporte_rodas", "automovel", ["fazenda", "terra", "roda", "pneu", "motor"]),
    ("ambulancia", "transporte_rodas", "automovel", ["hospital", "medico", "carro", "sirene"]),
    ("helicóptero" if False else "helicoptero", "transporte_rodas", "aereo", ["aviao", "helice", "voo", "ceu"]),
    ("aeroporto", "transporte_rodas", "aereo", ["aviao", "viagem", "mala", "voo"]),
    ("porto", "transporte_rodas", "aquatico", ["navio", "barco", "mar", "carga"]),
    ("energia", "tecnologia_ciencias", "energia", ["luz", "eletricidade", "sol", "bateria"]),
    ("eletricidade", "tecnologia_ciencias", "energia", ["luz", "energia", "fio", "tomada"]),
    ("luz", "natureza_clima", "elemento", ["sol", "lampada", "dia", "energia"]),
    ("escuro", "natureza_clima", "elemento", ["noite", "lua", "sombra", "medo"]),
    ("sombra", "natureza_clima", "elemento", ["sol", "arvore", "luz", "escuro"]),
    ("ouro", "sociedade_cidade", "economia", ["dinheiro", "anel", "joia", "riqueza"]),
    ("prata", "sociedade_cidade", "economia", ["ouro", "joia", "lua", "metal"]),
    ("metal", "tecnologia_ciencias", "materia", ["ferro", "aco", "ouro", "carro"]),
    ("madeira", "natureza_clima", "flora", ["arvore", "floresta", "mesa", "porta"]),
    ("vidro", "moradia_casa", "abertura", ["janela", "espelho", "copo", "transparente"]),
    ("plastico", "tecnologia_ciencias", "materia", ["garrafa", "objeto", "reciclagem"]),
    ("borracha", "transporte_rodas", "roda_borracha", ["pneu", "roda", "sapato", "elastico"]),
    ("tecido", "vestuario_moda", "roupa", ["camisa", "roupa", "cortina", "sofa"]),
    ("couro", "vestuario_moda", "calcado", ["sapato", "jaqueta", "cinto", "bota"]),
    ("familia", "vida_filosofia_emocao", "afeto", ["casa", "amor", "pai", "mae", "filho"]),
    ("amigo", "vida_filosofia_emocao", "afeto", ["amizade", "confianca", "cachorro", "parceria"]),
    ("crianca", "vida_filosofia_emocao", "existencia", ["escola", "brinquedo", "familia", "nascimento"]),
    ("jovem", "vida_filosofia_emocao", "existencia", ["escola", "futuro", "vida", "energia"]),
    ("idoso", "vida_filosofia_emocao", "existencia", ["tempo", "experiencia", "vida", "familia"]),
    ("saude", "corpo_saude", "saude", ["vida", "medico", "hospital", "remedio", "esporte"]),
    ("doenca", "corpo_saude", "saude", ["hospital", "remedio", "medico", "dor", "cura"]),
    ("dor", "corpo_saude", "saude", ["doenca", "remedio", "tristeza", "corpo"]),
    ("cura", "corpo_saude", "saude", ["remedio", "medico", "saude", "vida"]),
    ("sono", "corpo_saude", "corpo", ["cama", "travesseiro", "dormir", "noite", "sonho"]),
    ("fome", "alimentacao_bebida", "geral", ["comida", "pao", "almoco", "prato"]),
    ("sede", "alimentacao_bebida", "bebida", ["agua", "copo", "suco", "calor"]),
    ("frio", "natureza_clima", "astro_clima", ["inverno", "neve", "gelo", "casaco"]),
    ("calor", "natureza_clima", "astro_clima", ["verao", "sol", "fogo", "praia"]),
    ("ciencia", "tecnologia_ciencias", "educacao", ["estudo", "universo", "laboratorio", "computador"]),
    ("historia", "tecnologia_ciencias", "educacao", ["livro", "passado", "tempo", "castelo"]),
    ("natureza", "natureza_clima", "flora", ["arvore", "floresta", "animal", "rio", "vida"]),
    ("mundo", "natureza_clima", "relevo", ["terra", "planeta", "oceano", "cidade", "vida"]),
    ("brasil", "sociedade_cidade", "urbano", ["futebol", "praia", "floresta", "cidade"]),
    ("guerra", "sociedade_cidade", "justica", ["paz", "soldado", "conflito", "historia"]),
    ("justica", "sociedade_cidade", "justica", ["juiz", "advogado", "lei", "verdade"]),
    ("lei", "sociedade_cidade", "justica", ["justica", "policia", "juiz", "advogado"]),
    ("esperteza", "vida_filosofia_emocao", "psique", ["inteligencia", "ideia", "mente"]),
    ("inteligencia", "vida_filosofia_emocao", "psique", ["cerebro", "estudo", "ideia", "robo"]),
    ("ideia", "vida_filosofia_emocao", "psique", ["pensamento", "mente", "luz", "cerebro"]),
    ("pensamento", "vida_filosofia_emocao", "psique", ["ideia", "mente", "cerebro", "memoria"]),
    # Comunicacao, Fala & Acoes Humanas Cotidianas
    ("fala", "vida_filosofia_emocao", "comunicacao", ["voz", "palavra", "boca", "falar", "conversa", "linguagem", "som"], "Capacidade humana de articular palavras e sons pela boca para se comunicar."),
    ("falar", "vida_filosofia_emocao", "comunicacao", ["fala", "voz", "palavra", "conversa", "boca", "dizer"], "Expressar pensamentos e ideias por meio da voz e das palavras."),
    ("voz", "corpo_saude", "comunicacao", ["fala", "som", "cantar", "garganta", "boca", "palavra"], "Som produzido pelas cordas vocais humanas ao falar ou cantar."),
    ("palavra", "tecnologia_ciencias", "comunicacao", ["fala", "livro", "escrever", "letra", "texto", "lingua"], "Unidade da lingua dotada de significado usada na fala e na escrita."),
    ("conversa", "vida_filosofia_emocao", "comunicacao", ["fala", "amigo", "dialogo", "palavra", "voz"], "Troca de palavras e ideias entre duas ou mais pessoas."),
    ("silencio", "vida_filosofia_emocao", "afeto", ["paz", "noite", "calma", "som", "fala"], "Ausencia completa de ruidos, sons ou falas."),
    ("som", "esporte_musica_lazer", "musica", ["musica", "voz", "ouvido", "fala", "barulho"], "Vibracao que se propaga pelo ar e e percebida pelo ouvido."),
    ("dormir", "corpo_saude", "descanso", ["sono", "cama", "travesseiro", "noite", "sonho", "quarto", "descanso"], "Entrar em estado de repouso e sono profundo para recuperar as energias."),
    ("acordar", "corpo_saude", "descanso", ["manha", "despertador", "dormir", "sono", "sol"], "Despertar do sono ao abrir os olhos pela manha."),
    ("sonhar", "vida_filosofia_emocao", "psique", ["sonho", "dormir", "sono", "noite", "imaginacao"], "Ter sonhos enquanto dorme ou imaginar desejos para o futuro."),
    ("comer", "alimentacao_bebida", "geral", ["comida", "fome", "prato", "boca", "almoco"], "Ingerir alimentos para nutrir o corpo e matar a fome."),
    ("beber", "alimentacao_bebida", "bebida", ["agua", "sede", "copo", "suco", "boca"], "Ingerir liquidos como agua, suco ou cafe para matar a sede."),
    ("andar", "corpo_saude", "movimento", ["pe", "sapato", "perna", "rua", "caminhar"], "Deslocar-se a pe dando passos pelo chao."),
    ("correr", "esporte_musica_lazer", "esporte", ["corrida", "perna", "tenis", "velocidade", "esporte"], "Mover-se rapidamente com passadas aceleradas."),
    ("cantar", "esporte_musica_lazer", "musica", ["voz", "musica", "som", "microfone", "melodia"], "Emitir sons musicais e melodias com a propria voz."),
    ("ler", "tecnologia_ciencias", "educacao", ["livro", "olho", "palavra", "pagina", "estudo"], "Interpretar palavras e historias escritas em livros ou telas."),
    ("escrever", "tecnologia_ciencias", "educacao", ["caneta", "lapis", "papel", "palavra", "teclado", "livro"], "Registrar palavras e pensamentos com caneta ou teclado."),
    ("dirigir", "transporte_rodas", "direcao", ["carro", "volante", "motorista", "estrada", "viagem"], "Conduzir um veiculo controlando o volante e os pedais."),
    ("viajar", "transporte_rodas", "via", ["viagem", "aviao", "carro", "mala", "ferias", "estrada"], "Deslocar-se para outra cidade ou pais a passeio ou trabalho."),
    ("amar", "vida_filosofia_emocao", "afeto", ["amor", "coracao", "carinho", "familia", "paixao"], "Sentir grande afeto, dedicacao e amor por alguem."),
    ("viver", "vida_filosofia_emocao", "existencia", ["vida", "tempo", "mundo", "respirar", "existir"], "Ter vida, existir e experimentar os momentos do mundo."),
    ("sorrir", "vida_filosofia_emocao", "afeto", ["alegria", "boca", "felicidade", "dente", "amor"], "Curvar os labios em expressao de alegria e simpatia."),
    ("chorar", "vida_filosofia_emocao", "afeto", ["tristeza", "lagrima", "olho", "dor", "saudade"], "Derramar lagrimas pelos olhos em momentos de tristeza ou emocao.")
]

WORDS_DB = {}
SECRET_POOL = []

for entry in RAW_ENTRIES:
    word, theme_key, sub, links, hint = entry
    theme = THEMES[theme_key]
    WORDS_DB[word] = {
        "word": word,
        "category": theme["label"],
        "cluster": theme_key,
        "sub": sub,
        "vec": theme["vec"].slice() if hasattr(theme["vec"], "slice") else list(theme["vec"]),
        "links": links,
        "hint": hint
    }
    SECRET_POOL.append(word)

for item in EXTENDED_VOCABULARY:
    word = item[0]
    theme_key = item[1]
    sub = item[2]
    links = item[3]
    hint = item[4] if len(item) > 4 else f"Conceito de {THEMES[theme_key]['label']} relacionado a {', '.join(links[:3])}."
    theme = THEMES[theme_key]
    if word not in WORDS_DB:
        WORDS_DB[word] = {
            "word": word,
            "category": theme["label"],
            "cluster": theme_key,
            "sub": sub,
            "vec": list(theme["vec"]),
            "links": links,
            "hint": hint
        }
        SECRET_POOL.append(word)

output_js = (
    "/**\n"
    " * BANCO DE DADOS SEMANTICO EXPANDIDO DA LINGUA PORTUGUESA (js/dictionary-data.js)\n"
    " * Mais de 250+ palavras nucleares mapeadas + suporte assincrono a API online de dicionario.\n"
    " */\n"
    "window.DUELO_DATA = {\n"
    f"  THEMES: {json.dumps(THEMES, ensure_ascii=False, indent=2)},\n"
    f"  WORDS: {json.dumps(WORDS_DB, ensure_ascii=False, indent=2)},\n"
    f"  SECRET_POOL: {json.dumps(SECRET_POOL, ensure_ascii=False)},\n"
    f"  ALIASES: {json.dumps(ALIASES, ensure_ascii=False, indent=2)}\n"
    "};\n"
)

out_path = os.path.join(JS_DIR, "dictionary-data.js")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(output_js)

print(f"[OK] Banco semantico compilado com sucesso! Total de palavras nucleares: {len(WORDS_DB)}, Aliases: {len(ALIASES)}")
