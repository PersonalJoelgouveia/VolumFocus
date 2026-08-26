import type { Exercise } from '../types/exercise';

export const DEFAULT_EXERCISES: Exercise[] = [

  {id:'e1', name:'Supino Reto com Barra',         agonist:'Peito',               synergist:['Tríceps','Ombros'],           stabilizer:['Extensores da Coluna']},
  {id:'e2', name:'Supino Inclinado com Halteres',  agonist:'Peito',               synergist:['Tríceps','Ombros'],           stabilizer:[]},
  {id:'e3', name:'Supino Supinado com Halteres',   agonist:'Peito',               synergist:['Tríceps'],                    stabilizer:[]},
  {id:'e4', name:'Crucifixo Reto',                 agonist:'Peito',               synergist:['Ombros'],                     stabilizer:[]},
  {id:'e5', name:'Crucifixo Máquina',              agonist:'Peito',               synergist:[],                             stabilizer:[]},
  {id:'e6', name:'Cross Over Cabo',                agonist:'Peito',               synergist:[],                             stabilizer:['Abdômen']},
  {id:'e7', name:'Flexão de Braços',               agonist:'Peito',               synergist:['Tríceps','Ombros'],           stabilizer:['Abdômen','Extensores da Coluna']},
  {id:'e8', name:'Puxada Frontal',                 agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e9', name:'Remada Curvada',                 agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:['Extensores da Coluna']},
  {id:'e10',name:'Remada Unilateral',              agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:['Extensores da Coluna']},
  {id:'e11',name:'Levantamento Terra',             agonist:'Costas',              synergist:['Isquiotibiais','Glúteos'],    stabilizer:['Extensores da Coluna','Abdômen']},
  {id:'e12',name:'Barra Fixa',                     agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e13',name:'Remada Máquina',                 agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e14',name:'Agachamento Livre',              agonist:'Quadríceps',          synergist:['Glúteos','Isquiotibiais'],    stabilizer:['Extensores da Coluna','Abdômen']},
  {id:'e15',name:'Leg Press 45°',                  agonist:'Quadríceps',          synergist:['Glúteos','Isquiotibiais'],    stabilizer:[]},
  {id:'e16',name:'Extensora',                      agonist:'Quadríceps',          synergist:[],                             stabilizer:[]},
  {id:'e17',name:'Hack Squat',                     agonist:'Quadríceps',          synergist:['Glúteos'],                    stabilizer:['Extensores da Coluna']},
  {id:'e18',name:'Avanço (Lunge)',                 agonist:'Quadríceps',          synergist:['Glúteos','Isquiotibiais'],    stabilizer:[]},
  {id:'e19',name:'Mesa Flexora',                   agonist:'Isquiotibiais',       synergist:[],                             stabilizer:[]},
  {id:'e20',name:'Stiff',                          agonist:'Isquiotibiais',       synergist:['Glúteos'],                    stabilizer:['Extensores da Coluna']},
  {id:'e21',name:'Hip Thrust',                     agonist:'Glúteos',             synergist:['Isquiotibiais'],              stabilizer:['Extensores da Coluna']},
  {id:'e22',name:'Flexora em Pé',                  agonist:'Isquiotibiais',       synergist:[],                             stabilizer:[]},
  {id:'e23',name:'Cadeira Abdutora',               agonist:'Glúteos',             synergist:[],                             stabilizer:[]},
  {id:'e24',name:'Desenvolvimento Arnold',         agonist:'Ombros',              synergist:['Tríceps'],                    stabilizer:['Extensores da Coluna']},
  {id:'e25',name:'Desenvolvimento Máquina',        agonist:'Ombros',              synergist:['Tríceps'],                    stabilizer:[]},
  {id:'e26',name:'Elevação Lateral',               agonist:'Ombros',              synergist:[],                             stabilizer:[]},
  {id:'e27',name:'Elevação Frontal',               agonist:'Ombros',              synergist:[],                             stabilizer:[]},
  {id:'e28',name:'Face Pull',                      agonist:'Ombros',              synergist:['Costas'],                     stabilizer:[]},
  {id:'e29',name:'Rosca Direta',                   agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e30',name:'Rosca Alternada',                agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e31',name:'Rosca Martelo',                  agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e32',name:'Rosca Concentrada',              agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e33',name:'Tríceps Corda',                  agonist:'Tríceps',             synergist:[],                             stabilizer:[]},
  {id:'e34',name:'Tríceps Testa',                  agonist:'Tríceps',             synergist:[],                             stabilizer:[]},
  {id:'e35',name:'Tríceps Francês',                agonist:'Tríceps',             synergist:[],                             stabilizer:[]},
  {id:'e36',name:'Tríceps Paralela Máquina',       agonist:'Tríceps',             synergist:['Peito'],                      stabilizer:[]},
  {id:'e37',name:'Panturrilha em Pé',              agonist:'Panturrilhas',        synergist:[],                             stabilizer:[]},
  {id:'e38',name:'Panturrilha Sentado',            agonist:'Panturrilhas',        synergist:[],                             stabilizer:[]},
  {id:'e39',name:'Abdominal Crunch',               agonist:'Abdômen',             synergist:[],                             stabilizer:[]},
  {id:'e40',name:'Prancha Isométrica',             agonist:'Extensores da Coluna',synergist:['Abdômen'],                    stabilizer:[]},
  {id:'e41',name:'Russian Twist',                  agonist:'Abdômen',             synergist:[],                             stabilizer:[]},
  {id:'e42',name:'Abdominal Infra',                agonist:'Abdômen',             synergist:[],                             stabilizer:[]},
  {id:'e43',name:'Pallof Press',                   agonist:'Extensores da Coluna',synergist:['Ombros'],                     stabilizer:['Abdômen']},
  {id:'e44',name:'Hiperextensão Lombar',           agonist:'Extensores da Coluna',synergist:['Glúteos'],                    stabilizer:[]},
  {id:'e45',name:'Bird Dog',                       agonist:'Extensores da Coluna',synergist:['Abdômen'],                    stabilizer:[]},
  {id:'e46',name:'Good Morning',                   agonist:'Extensores da Coluna',synergist:['Isquiotibiais'],              stabilizer:[]},

  // ── Peito — variações de ângulo e equipamento ──
  {id:'e47',name:'Supino Declinado com Barra',     agonist:'Peito',               synergist:['Tríceps'],                    stabilizer:[]},
  {id:'e48',name:'Crucifixo Inclinado com Halteres',agonist:'Peito',              synergist:['Ombros'],                     stabilizer:[]},
  {id:'e49',name:'Peck Deck (Voador)',             agonist:'Peito',               synergist:[],                             stabilizer:[]},
  {id:'e50',name:'Supino Máquina',                 agonist:'Peito',               synergist:['Tríceps','Ombros'],           stabilizer:[]},
  {id:'e51',name:'Flexão Diamante',                agonist:'Peito',               synergist:['Tríceps'],                    stabilizer:['Abdômen']},
  {id:'e52',name:'Cross Over Polia Baixa (Peito Superior)',agonist:'Peito',       synergist:['Ombros'],                     stabilizer:[]},

  // ── Costas — variações de pegada e equipamento ──
  {id:'e53',name:'Puxada Triângulo',               agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e54',name:'Remada Cavalinho (T-Bar)',       agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:['Extensores da Coluna']},
  {id:'e55',name:'Pulldown Pegada Supinada',       agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e56',name:'Remada Baixa na Polia',          agonist:'Costas',              synergist:['Bíceps'],                     stabilizer:[]},
  {id:'e57',name:'Pull-over na Polia Alta',        agonist:'Costas',              synergist:['Peito'],                      stabilizer:[]},
  {id:'e58',name:'Encolhimento de Ombros (Shrug)', agonist:'Costas',              synergist:['Ombros'],                     stabilizer:[]},

  // ── Quadríceps — variações unilaterais e de padrão de movimento ──
  {id:'e59',name:'Agachamento Frontal',            agonist:'Quadríceps',          synergist:['Glúteos'],                    stabilizer:['Abdômen','Extensores da Coluna']},
  {id:'e60',name:'Agachamento Búlgaro',            agonist:'Quadríceps',          synergist:['Glúteos'],                    stabilizer:['Extensores da Coluna']},
  {id:'e61',name:'Step Up com Halteres',           agonist:'Quadríceps',          synergist:['Glúteos'],                    stabilizer:[]},
  {id:'e62',name:'Agachamento no Smith',           agonist:'Quadríceps',          synergist:['Glúteos'],                    stabilizer:[]},

  // ── Isquiotibiais — padrão de dobradiça de quadril ──
  {id:'e63',name:'Levantamento Terra Romeno',      agonist:'Isquiotibiais',       synergist:['Glúteos'],                    stabilizer:['Extensores da Coluna']},
  {id:'e64',name:'Glute Ham Raise',                agonist:'Isquiotibiais',       synergist:['Glúteos'],                    stabilizer:['Extensores da Coluna']},

  // ── Glúteos — variações de empuxo e abdução ──
  {id:'e65',name:'Coice na Polia (Cable Kickback)',agonist:'Glúteos',             synergist:['Isquiotibiais'],              stabilizer:[]},
  {id:'e66',name:'Agachamento Sumô com Halter',    agonist:'Glúteos',             synergist:['Quadríceps','Isquiotibiais'], stabilizer:['Extensores da Coluna']},

  // ── Ombros — deltoide anterior, lateral e posterior ──
  {id:'e67',name:'Desenvolvimento Militar com Barra',agonist:'Ombros',           synergist:['Tríceps'],                    stabilizer:['Abdômen']},
  {id:'e68',name:'Remada Alta',                    agonist:'Ombros',              synergist:['Costas'],                     stabilizer:[]},
  {id:'e69',name:'Crucifixo Invertido (Reverse Fly)',agonist:'Ombros',           synergist:['Costas'],                     stabilizer:[]},
  {id:'e70',name:'Elevação Lateral na Polia',      agonist:'Ombros',              synergist:[],                             stabilizer:[]},

  // ── Bíceps — variações de pegada e ângulo ──
  {id:'e71',name:'Rosca Scott',                    agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e72',name:'Rosca na Polia',                 agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e73',name:'Rosca Inversa',                  agonist:'Bíceps',              synergist:[],                             stabilizer:[]},
  {id:'e74',name:'Rosca 21',                       agonist:'Bíceps',              synergist:[],                             stabilizer:[]},

  // ── Tríceps — variações de cabo, peso livre e peso do corpo ──
  {id:'e75',name:'Tríceps Coice (Kickback)',       agonist:'Tríceps',             synergist:[],                             stabilizer:[]},
  {id:'e76',name:'Tríceps na Polia Pegada Invertida',agonist:'Tríceps',           synergist:[],                             stabilizer:[]},
  {id:'e77',name:'Mergulho no Banco (Bench Dips)', agonist:'Tríceps',             synergist:['Ombros'],                     stabilizer:[]},
  {id:'e78',name:'Paralelas (Dips)',               agonist:'Tríceps',             synergist:['Peito','Ombros'],             stabilizer:[]},

  // ── Panturrilhas — variações de carga e amplitude ──
  {id:'e79',name:'Panturrilha no Leg Press',       agonist:'Panturrilhas',        synergist:[],                             stabilizer:[]},
  {id:'e80',name:'Burrinho (Donkey Calf Raise)',   agonist:'Panturrilhas',        synergist:[],                             stabilizer:[]},

  // ── Abdômen — flexão, rotação e estabilização lateral ──
  {id:'e81',name:'Elevação de Pernas Suspenso',    agonist:'Abdômen',             synergist:[],                             stabilizer:[]},
  {id:'e82',name:'Abdominal na Polia (Cable Crunch)',agonist:'Abdômen',           synergist:[],                             stabilizer:[]},
  {id:'e83',name:'Prancha Lateral',                agonist:'Abdômen',             synergist:['Extensores da Coluna'],       stabilizer:[]},

  // ── Extensores da Coluna — cadeia posterior ──
  {id:'e84',name:'Superman',                       agonist:'Extensores da Coluna',synergist:['Glúteos'],                    stabilizer:[]},
  // ── Cardiorrespiratórios ──
  {id:'c1', name:'Esteira (Corrida)',              agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c2', name:'Esteira (Caminhada)',            agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c3', name:'Bicicleta Ergométrica',          agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c4', name:'Elíptico',                       agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c5', name:'Escada (StairMaster)',           agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c6', name:'Remo Ergométrico',               agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c7', name:'Pular Corda',                    agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c8', name:'Natação',                        agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c9', name:'HIIT Funcional',                 agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c10',name:'Bicicleta ao Ar Livre',          agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]},
  {id:'c11',name:'Corrida ao Ar Livre',            agonist:'Cardio', type:'cardio', synergist:[], stabilizer:[]}
];
