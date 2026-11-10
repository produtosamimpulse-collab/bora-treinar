export type Posicionamento = { rotulo: 'Pés' | 'Braços' | 'Posição'; texto: string }

function pes(texto: string): Posicionamento {
  return { rotulo: 'Pés', texto }
}

function bracos(texto: string): Posicionamento {
  return { rotulo: 'Braços', texto }
}

function posicao(texto: string): Posicionamento {
  return { rotulo: 'Posição', texto }
}

export const POSICIONAMENTO: Record<string, Posicionamento> = {
  'abdominal-com-rodinha-com-apoio': posicao('Joelhos no colchonete, braços estendidos segurando a rodinha embaixo dos ombros. Vá só até onde a lombar não afunda.'),
  'abdominal-infra-bike': posicao('Lombar colada no chão, mãos atrás da cabeça sem puxar o pescoço. Cotovelo vai em direção ao joelho oposto.'),
  'abdominal-infra-com-pernas-estendidas': posicao('Lombar colada no chão, mãos embaixo do quadril. Pernas juntas e estendidas, sobe e desce sem encostar os pés no chão.'),
  'abdominal-remador': posicao('Sentada, braços estendidos à frente. Joelhos vêm ao peito enquanto o tronco se aproxima, e estende tudo na volta.'),
  'abdominal-supra-na-bola-suica': posicao('Bola apoiando a lombar, pés no chão na largura do quadril. Mãos atrás da cabeça, sobe só até as escápulas saírem da bola.'),
  'abdominal-tesoura': posicao('Lombar colada no chão, mãos embaixo do quadril. Pernas estendidas alternando cima e baixo, sem encostar no chão.'),
  'prancha-frontal': posicao('Cotovelos embaixo dos ombros, antebraços paralelos. Pés juntos na ponta, corpo reto da cabeça ao calcanhar, glúteo contraído.'),

  'aducao-de-quadril-na-maquina': pes('Pés apoiados no suporte, joelhos alinhados com eles. Costas coladas no encosto, feche as pernas devagar.'),
  'aducao-de-quadril-na-polia-unilateral': pes('Tornozeleira na perna de dentro, pé de apoio firme e levemente afastado da polia. Puxa a perna cruzando à frente da outra.'),
  'aducao-simultanea-com-caneleira': pes('Deitada de lado, pé de cima apoiado à frente do joelho de baixo. Sobe a perna de baixo estendida, ponta do pé para frente.'),

  'rosca-direta-21-na-polia-baixa': bracos('Cotovelos colados no corpo e parados. Pegada na largura dos ombros, palmas para cima: 7 até o meio, 7 do meio para cima, 7 completas.'),
  'rosca-direta-com-halteres': bracos('Cotovelos colados na lateral do corpo, palmas para frente. Sobe sem balançar o tronco e desce até estender quase todo.'),
  'rosca-direta-na-polia-baixa-com-corda': bracos('Cotovelos colados no corpo, mãos na corda com palmas uma de frente para a outra. Sobe sem mexer o cotovelo para frente.'),
  'rosca-direta-na-polia-barra-reta': bracos('Pegada na largura dos ombros, palmas para cima, cotovelos colados no corpo. Só o antebraço se move.'),

  'bicicleta-horizontal': pes('Banco ajustado para o joelho ficar quase estendido no pedal de baixo. Meio do pé no pedal, costas apoiadas.'),
  'caminhada-na-esteira': pes('Passada natural pisando com o calcanhar e rolando até a ponta. Evite segurar no apoio da esteira.'),
  'mini-jump': pes('Pés na largura do quadril, pisando no centro da cama elástica. Joelhos levemente dobrados, sem travar.'),

  'agachamento-com-desenvolvimento-halter-no-chao': posicao('Pés um pouco mais abertos que o quadril, pontas levemente para fora. Halteres na altura dos ombros, sobe empurrando acima da cabeça.'),
  'burpee-adaptado': posicao('Mãos no chão na largura dos ombros, leva um pé de cada vez para trás e volta. Pés na largura do quadril ao levantar.'),

  'puxada-aberta-na-barra-reta': bracos('Pegada bem aberta, palmas para frente. Peito aberto e tronco levemente inclinado para trás, puxa a barra até o alto do peito.'),
  'puxada-fechada-na-barra-reta': bracos('Pegada na largura dos ombros, palmas para frente. Puxa a barra até o peito levando os cotovelos para baixo e para trás.'),
  'puxada-frontal': bracos('Pegada um pouco mais aberta que os ombros. Ombros longe das orelhas, puxa até a altura do queixo sem jogar o tronco.'),
  'remada-baixa-supinada': bracos('Palmas para cima, cotovelos rentes ao corpo. Coluna reta, puxa até a barriga juntando as escápulas.'),
  'remada-com-elastico': bracos('Braços estendidos à frente, palmas uma de frente para a outra. Puxa levando os cotovelos para trás, rentes ao corpo.'),
  'remada-curvada-com-halteres': bracos('Tronco inclinado com coluna reta, palmas viradas para o corpo. Puxa os halteres até a cintura, cotovelos rentes.'),
  'remada-fechada-sentada-com-faixa-elastica': bracos('Sentada com pernas estendidas e faixa nos pés. Palmas uma de frente para a outra, puxa até a barriga juntando as escápulas.'),

  'abducao-de-quadril-na-maquina': pes('Pés apoiados no suporte, costas no encosto. Abre as pernas empurrando com a lateral dos joelhos e volta devagar.'),
  'abducao-de-quadril-na-polia-baixa-unilateral': pes('Tornozeleira na perna de fora, pé de apoio firme ao lado da polia. Leva a perna para o lado com a ponta do pé para frente.'),
  'abducao-em-decubito-lateral-com-elastico': pes('Deitada de lado, elástico acima dos joelhos. Pernas uma sobre a outra, sobe a de cima com a ponta do pé para frente.'),
  'agachamento-com-abducao-alternada': pes('Elástico acima dos joelhos, pés na largura do quadril. Agacha e ao subir leva uma perna para o lado, alternando.'),
  'elevacao-pelvica-com-barra': pes('Costas no banco na altura das escápulas, pés no chão na largura do quadril. Canela fica vertical lá em cima.'),
  'elevacao-pelvica-no-step-com-elastico': pes('Ombros no chão, pés no step na largura do quadril. Elástico acima dos joelhos, empurra o quadril para cima.'),
  'extensao-de-quadril-em-pe-com-elastico': pes('Pé de apoio firme, joelho levemente dobrado. Leva a outra perna para trás sem arquear a lombar.'),
  'ponte-de-gluteo': pes('Deitada, pés no chão na largura do quadril e perto do glúteo. Empurra pelos calcanhares e sobe o quadril.'),

  'mobilidade-de-corpo-inteiro': posicao('Movimentos amplos e lentos, sem forçar o fim do movimento.'),
  'mobilidade-de-escapula-com-bola': posicao('Mãos na bola contra a parede, braços estendidos. Movimenta só as escápulas, aproximando e afastando.'),
  'mobilidade-de-escapula-variacao-xii': posicao('Braços estendidos, ombros longe das orelhas. Movimenta só as escápulas, sem dobrar os cotovelos.'),
  'mobilidade-de-quadril': posicao('Movimentos lentos e controlados, sem forçar o fim do movimento.'),

  'abducao-de-ombros-com-elastico': bracos('Pise no elástico, braços ao lado do corpo com cotovelos levemente dobrados. Sobe até a altura dos ombros.'),
  'desenvolvimento-com-faixa-elastica': bracos('Mãos na altura dos ombros, palmas para frente, cotovelos um pouco à frente do corpo. Empurra para cima sem arquear a lombar.'),
  'elevacao-frontal-alternada': bracos('Halteres à frente das coxas, palmas para baixo. Sobe um braço por vez até a altura dos ombros, cotovelo levemente dobrado.'),
  'elevacao-lateral': bracos('Halteres ao lado do corpo, cotovelos levemente dobrados. Sobe até a altura dos ombros, sem subir os ombros junto.'),

  'elevacao-de-panturrilha-em-pe': pes('Pés na largura do quadril, pontas para frente. Sobe o máximo na ponta dos pés e desce devagar.'),
  'panturrilha-no-step': pes('Só a ponta dos pés no step, calcanhares para fora. Desce o calcanhar abaixo do step e sobe o máximo.'),

  'crossover-na-polia': bracos('Um pé à frente, tronco levemente inclinado. Cotovelos levemente dobrados e fixos, junta as mãos à frente do peito.'),
  'crucifixo-com-elastico': bracos('Braços abertos na altura do peito, cotovelos levemente dobrados. Fecha as mãos à frente do peito como num abraço.'),
  'crucifixo-com-halteres': bracos('Deitada no banco, palmas uma de frente para a outra, cotovelos levemente dobrados. Abre até a altura do peito.'),
  'crucifixo-inclinado-com-halteres': bracos('Banco inclinado, palmas uma de frente para a outra, cotovelos levemente dobrados. Abre até a linha do peito, sem passar.'),
  'flexao-de-bracos-com-joelhos-apoiados': bracos('Mãos um pouco mais abertas que os ombros, dedos para frente. Cotovelos a uns 45 graus do corpo ao descer.'),
  'supino-inclinado-com-halteres': bracos('Banco inclinado, halteres na linha do peito e palmas para frente. Cotovelos a uns 45 graus do corpo, empurra para cima.'),
  'supino-reto-com-halteres': bracos('Halteres na linha do meio do peito, palmas para frente. Cotovelos a uns 45 graus do corpo, escápulas juntas no banco.'),
  'voador-peck-deck': bracos('Braços na altura do peito, cotovelos levemente dobrados. Costas coladas no encosto, fecha à frente do peito.'),

  'cadeira-flexora-unilateral': pes('Rolo logo acima do calcanhar, joelho alinhado ao eixo da máquina. Ponta do pé para cima, dobra uma perna por vez.'),
  'cadeira-flexora': pes('Rolo logo acima dos calcanhares, joelhos alinhados ao eixo da máquina. Pés juntos com a ponta para cima.'),
  'flexora-deitada-com-halter-entre-as-pernas': pes('Deitada de bruços, halter preso entre os pés. Pés juntos com a ponta para cima, dobra os joelhos sem tirar o quadril do banco.'),
  'mesa-flexora': pes('Rolo logo acima dos calcanhares, joelhos um pouco para fora do banco. Quadril colado no banco, pés com a ponta para cima.'),
  'stiff-com-halteres': pes('Pés na largura do quadril, pontas para frente, joelhos levemente dobrados. Desce os halteres rentes às pernas com a coluna reta.'),

  'afundo-alternado': pes('Passo grande à frente, pés na largura do quadril como em trilhos. Joelho da frente na direção do pé, o de trás desce quase ao chão.'),
  'afundo-com-faixa-elastica': pes('Um pé à frente e outro atrás, separados como em trilhos. Desce reto, joelho da frente na direção da ponta do pé.'),
  'agachamento-com-bola-suica': pes('Bola entre a lombar e a parede, pés um pouco à frente do corpo na largura do quadril. Desce até as coxas ficarem paralelas ao chão.'),
  'agachamento-hack-na-maquina': pes('Pés no meio da plataforma, na largura do quadril, pontas levemente para fora. Costas e cabeça coladas no encosto.'),
  'agachamento-isometrico-com-panturrilha': pes('Costas na parede, pés na largura do quadril. Joelhos a 90 graus, sobe e desce os calcanhares mantendo a posição.'),
  'agachamento-isometrico': pes('Costas na parede, pés na largura do quadril e à frente do corpo. Joelhos a 90 graus, em cima dos tornozelos.'),
  'agachamento-livre': pes('Pés na largura dos ombros, pontas levemente para fora. Joelhos acompanham a direção dos pés, calcanhar no chão.'),
  'agachamento-na-polia-baixa': pes('Pés na largura dos ombros, pontas levemente para fora. Desce com o peito aberto e o calcanhar no chão.'),
  'agachamento-no-smith': pes('Pés na largura dos ombros, um pouco à frente da barra, pontas levemente para fora. Calcanhar no chão o tempo todo.'),
  'agachamento-sumo-com-halter': pes('Pés bem mais abertos que os ombros, pontas para fora. Halter pendurado no meio, joelhos abrindo na direção dos pés.'),
  'avanco': pes('Passo grande à frente, pés na largura do quadril como em trilhos. Joelho da frente na direção do pé, tronco reto.'),
  'cadeira-extensora': pes('Rolo na frente do tornozelo, joelho alinhado ao eixo da máquina. Pés com a ponta para cima, costas no encosto.'),
  'extensao-de-joelho-unilateral-sentada-com-elastico': pes('Elástico no tornozelo, joelho na beira da cadeira. Estende a perna com a ponta do pé para cima.'),
  'extensao-de-perna-sentada-com-caneleira': pes('Caneleira no tornozelo, joelho na beira da cadeira. Estende a perna com a ponta do pé para cima e segura.'),
  'leg-press-45': pes('Pés no meio da plataforma, na largura dos ombros, pontas levemente para fora. Lombar colada no encosto, não trave os joelhos.'),
  'recuo-com-halteres': pes('Pés na largura do quadril, dá um passo grande para trás. Joelho da frente fica em cima do tornozelo.'),

  'triceps-coice-com-halteres': bracos('Tronco inclinado, cotovelo colado no corpo e parado na altura da cintura. Estende o braço para trás.'),
  'triceps-invertido-na-polia-com-barra': bracos('Palmas para cima, cotovelos colados no corpo e parados. Só o antebraço desce até estender.'),
  'triceps-na-polia-com-barra-reta': bracos('Palmas para baixo, mãos na largura dos ombros, cotovelos colados no corpo. Só o antebraço se move.'),
  'triceps-na-polia-com-barra-w': bracos('Mãos na curva da barra W, cotovelos colados no corpo e parados. Estende até o fim e volta até 90 graus.'),
  'triceps-unilateral-com-faixa-elastica': bracos('Cotovelo apontado para cima, perto da cabeça e parado. Estende o braço até o fim.'),
  'remada-curvada-com-barra': bracos('Pés na largura do quadril, joelhos semiflexionados e tronco inclinado a 45 graus. Puxa a barra na direção do umbigo, cotovelos rente ao corpo.'),
  'remada-unilateral-com-halter': bracos('Um joelho e uma mão no banco, costas retas. Puxa o halter na direção do quadril, cotovelo colado ao corpo, sem girar o tronco.'),
  'remada-sentada-na-maquina': bracos('Peito apoiado no suporte, costas retas. Puxa os pegadores até a linha das costelas, aproximando as escápulas.'),
  'remada-sentada-na-polia': bracos('Sentada com joelhos semiflexionados e tronco ereto. Puxa o triângulo até o abdômen, cotovelos rente ao corpo, sem jogar o tronco para trás.'),
  'remada-cavalinho': bracos('Pés firmes na plataforma, joelhos flexionados e tronco inclinado. Puxa a barra ao peito, cotovelos rente ao corpo, costas sempre retas.'),
  'puxada-na-polia': bracos('Pegada um pouco mais aberta que os ombros, tronco levemente para trás. Puxa a barra até a parte alta do peito descendo os cotovelos.'),
  'terra-romeno-com-barra': pes('Pés na largura do quadril, joelhos levemente flexionados e parados. Desce a barra rente às pernas empurrando o quadril para trás, costas retas.'),
  'bom-dia-com-barra': pes('Pés na largura do quadril, barra no trapézio. Joelhos semiflexionados, inclina o tronco à frente levando o quadril para trás, costas retas.'),
  'flexora-sentada': pes('Costas apoiadas e coxa travada pelo apoio. Rolo atrás do tornozelo, flexiona os joelhos levando os calcanhares para baixo do banco.'),
  'terra-romeno-unilateral-com-halter': pes('Peso em uma perna só, joelho levemente flexionado. Inclina o tronco à frente subindo a perna de trás, quadril para trás e costas retas.'),
  'supino-reto-com-barra': bracos('Pegada um pouco mais aberta que os ombros, punhos firmes. Desce a barra na linha do meio do peito, cotovelos a cerca de 45 graus do corpo.'),
  'supino-declinado-com-barra': bracos('Banco declinado, pegada na largura dos ombros. Desce a barra na parte de baixo do peito, cotovelos sem abrir demais.'),
  'supino-na-polia': bracos('Sentada de costas para a polia, pegadores na linha do peito. Empurra à frente até quase estender os cotovelos e volta controlando.'),
  'rosca-scott-com-barra': bracos('Axilas apoiadas no banco Scott, braços parados no apoio. Sobe a barra até perto do ombro e desce quase estendendo, sem tirar o cotovelo do apoio.'),
  'rosca-martelo-com-halteres': bracos('Em pé, palmas viradas uma para a outra. Cotovelos colados ao corpo e parados, sobe o halter sem girar o punho.'),
  'rosca-martelo-na-polia': bracos('Em pé de frente para a polia baixa, corda na mão com palmas frente a frente. Cotovelos colados ao corpo, sobe sem girar o punho.'),
  'elevacao-de-pernas-suspensa': posicao('Pendurada na barra, ombros ativos. Sobe as pernas estendidas até a linha do quadril sem balançar o corpo, desce controlando.'),
  'crunch-na-polia': posicao('Ajoelhada de frente para a polia alta, corda ao lado da cabeça. Enrola o tronco levando as costelas ao quadril, quadril parado.'),
  'crunch-na-maquina': posicao('Costas no apoio e peito contra o acolchoado. Enrola o tronco à frente contraindo o abdômen, sem puxar com os braços.'),
}
