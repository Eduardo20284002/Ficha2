import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

/* =========================================================================
   DADOS — extraídos do Livro do Jogador 2024 (D&D 5e), capítulos 1-6
   ========================================================================= */

const ABILITIES = ['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'];
const ABBR = { Força: 'FOR', Destreza: 'DES', Constituição: 'CON', Inteligência: 'INT', Sabedoria: 'SAB', Carisma: 'CAR' };

const SKILLS = {
  'Acrobacia': 'Destreza', 'Arcanismo': 'Inteligência', 'Atletismo': 'Força', 'Atuação': 'Carisma',
  'Enganação': 'Carisma', 'Furtividade': 'Destreza', 'História': 'Inteligência', 'Intimidação': 'Carisma',
  'Intuição': 'Sabedoria', 'Investigação': 'Inteligência', 'Lidar com Animais': 'Sabedoria', 'Medicina': 'Sabedoria',
  'Natureza': 'Inteligência', 'Percepção': 'Sabedoria', 'Persuasão': 'Carisma', 'Prestidigitação': 'Destreza',
  'Religião': 'Inteligência', 'Sobrevivência': 'Sabedoria',
};

const LANGUAGES_COMMON = ['Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico', 'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'];

const ALIGNMENTS = [
  { code: 'OB', name: 'Ordeiro e Bom', desc: 'Faz a coisa certa, conforme esperado pela sociedade.' },
  { code: 'NB', name: 'Neutro e Bom', desc: 'Faz o melhor que pode, sem se sentir obrigado pelas regras.' },
  { code: 'CB', name: 'Caótico e Bom', desc: 'Age conforme a própria consciência, pouco ligando pro que esperam de você.' },
  { code: 'ON', name: 'Ordeiro e Neutro', desc: 'Age de acordo com a lei, tradição ou um código pessoal.' },
  { code: 'N', name: 'Neutro', desc: 'Evita tomar partido, fazendo o que parece melhor no momento.' },
  { code: 'CN', name: 'Caótico e Neutro', desc: 'Segue os próprios impulsos, valorizando a liberdade acima de tudo.' },
  { code: 'OM', name: 'Ordeiro e Mau', desc: 'Toma metodicamente o que quer dentro de um código próprio.' },
  { code: 'NM', name: 'Neutro e Mau', desc: 'Não se importa com o mal que causa ao perseguir seus desejos.' },
  { code: 'CM', name: 'Caótico e Mau', desc: 'Age com violência arbitrária, movido por ódio ou sede de sangue.' },
];

const POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const STANDARD_ARRAY_BY_CLASS = {
  Guerreiro: { Força: 15, Destreza: 14, Constituição: 13, Inteligência: 8, Sabedoria: 10, Carisma: 12 },
  Ladino: { Força: 12, Destreza: 15, Constituição: 13, Inteligência: 14, Sabedoria: 10, Carisma: 8 },
};

function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}
function fmtMod(m) {
  return m >= 0 ? `+${m}` : `${m}`;
}

/* ---- Propriedades de arma e de maestria ---- */
const WEAPON_PROPERTY_DEFS = {
  'Acuidade': 'Pode usar seu modificador de Força ou Destreza (o que preferir) para as jogadas de ataque e dano.',
  'Arremesso': 'Pode ser arremessada para realizar um ataque à distância.',
  'Duas Mãos': 'Exige as duas mãos quando você ataca com ela.',
  'Extensão': 'Adiciona 1,5 metro ao seu alcance ao atacar (e para Ataques de Oportunidade).',
  'Leve': 'Ao atacar com ela, pode realizar um ataque adicional com outra arma Leve como Ação Bônus.',
  'Munição': 'Só pode ser usada à distância se você tiver munição disponível.',
  'Pesada': 'Desvantagem na jogada de ataque se seu valor de Força/Destreza relevante for menor que 13.',
  'Recarga': 'Só pode disparar uma munição por turno, não importa quantos ataques você tenha.',
  'Versátil': 'Pode ser usada com uma ou duas mãos; o dano entre parênteses é usado com duas mãos.',
};

const WEAPON_MASTERY_DEFS = {
  'Afligir': 'Ao causar dano com esta arma, você tem Vantagem na sua próxima jogada de ataque contra o mesmo alvo antes do fim do seu próximo turno.',
  'Ágil': 'O ataque adicional da propriedade Leve pode ser feito como parte da ação Atacar, em vez de Ação Bônus (uma vez por turno).',
  'Derrubar': 'Ao atingir, força a criatura a uma salvaguarda de Constituição (CD 8 + mod. + Bônus de Proficiência) ou ela fica Caída.',
  'Drenar': 'Ao atingir, a criatura tem Desvantagem na próxima jogada de ataque dela antes do início do seu próximo turno.',
  'Empurrar': 'Ao atingir, pode empurrar a criatura até 3 metros para longe (se for Grande ou menor).',
  'Garantido': 'Se a jogada de ataque errar, ainda assim causa dano igual ao seu modificador de atributo.',
  'Lentidão': 'Ao causar dano, reduz o Deslocamento da criatura em 3 metros até o início do seu próximo turno.',
  'Trespassar': 'Ao atingir corpo a corpo, pode atacar uma segunda criatura adjacente à primeira (sem somar o modificador de atributo).',
};

const WEAPONS = {
  'Adaga': { categoria: 'Simples Corpo a Corpo', dano: '1d4 Perfurante', prop: ['Acuidade', 'Arremesso (6/18)', 'Leve'], maestria: 'Ágil', peso: '0,5 kg', custo: '2 PO' },
  'Azagaia': { categoria: 'Simples Corpo a Corpo', dano: '1d6 Perfurante', prop: ['Arremesso (9/36)'], maestria: 'Lentidão', peso: '1 kg', custo: '5 PP' },
  'Cajado': { categoria: 'Simples Corpo a Corpo', dano: '1d6 Contundente', prop: ['Versátil (1d8)'], maestria: 'Derrubar', peso: '2 kg', custo: '2 PP' },
  'Clava': { categoria: 'Simples Corpo a Corpo', dano: '1d4 Contundente', prop: ['Leve'], maestria: 'Lentidão', peso: '1 kg', custo: '1 PP' },
  'Clava Grande': { categoria: 'Simples Corpo a Corpo', dano: '1d8 Contundente', prop: ['Duas Mãos'], maestria: 'Empurrar', peso: '5 kg', custo: '2 PP' },
  'Foice': { categoria: 'Simples Corpo a Corpo', dano: '1d4 Cortante', prop: ['Leve'], maestria: 'Ágil', peso: '1 kg', custo: '1 PO' },
  'Lança': { categoria: 'Simples Corpo a Corpo', dano: '1d6 Perfurante', prop: ['Arremesso (6/18)', 'Versátil (1d8)'], maestria: 'Drenar', peso: '1,5 kg', custo: '1 PO' },
  'Maça': { categoria: 'Simples Corpo a Corpo', dano: '1d6 Contundente', prop: [], maestria: 'Drenar', peso: '2 kg', custo: '5 PO' },
  'Machadinha': { categoria: 'Simples Corpo a Corpo', dano: '1d6 Cortante', prop: ['Arremesso (6/18)', 'Leve'], maestria: 'Afligir', peso: '1 kg', custo: '5 PO' },
  'Martelo Leve': { categoria: 'Simples Corpo a Corpo', dano: '1d4 Contundente', prop: ['Arremesso (6/18)', 'Leve'], maestria: 'Ágil', peso: '1 kg', custo: '2 PO' },
  'Arco Curto': { categoria: 'Simples à Distância', dano: '1d6 Perfurante', prop: ['Duas Mãos', 'Munição (24/96; Flecha)'], maestria: 'Afligir', peso: '1 kg', custo: '25 PO' },
  'Besta Leve': { categoria: 'Simples à Distância', dano: '1d8 Perfurante', prop: ['Duas Mãos', 'Munição (24/96; Virote)', 'Recarga'], maestria: 'Lentidão', peso: '2,5 kg', custo: '25 PO' },
  'Dardo': { categoria: 'Simples à Distância', dano: '1d4 Perfurante', prop: ['Acuidade', 'Arremesso (6/18)'], maestria: 'Afligir', peso: '150 g', custo: '5 PC' },
  'Funda': { categoria: 'Simples à Distância', dano: '1d4 Contundente', prop: ['Munição (9/36; Bala)'], maestria: 'Lentidão', peso: '—', custo: '1 PP' },
  'Alabarda': { categoria: 'Marcial Corpo a Corpo', dano: '1d10 Cortante', prop: ['Duas Mãos', 'Extensão', 'Pesada'], maestria: 'Trespassar', peso: '3 kg', custo: '20 PO' },
  'Chicote': { categoria: 'Marcial Corpo a Corpo', dano: '1d4 Cortante', prop: ['Acuidade', 'Extensão'], maestria: 'Lentidão', peso: '1,5 kg', custo: '2 PO' },
  'Cimitarra': { categoria: 'Marcial Corpo a Corpo', dano: '1d6 Cortante', prop: ['Acuidade', 'Leve'], maestria: 'Ágil', peso: '1,5 kg', custo: '25 PO' },
  'Espada Curta': { categoria: 'Marcial Corpo a Corpo', dano: '1d6 Perfurante', prop: ['Acuidade', 'Leve'], maestria: 'Afligir', peso: '1 kg', custo: '10 PO' },
  'Espada Grande': { categoria: 'Marcial Corpo a Corpo', dano: '2d6 Cortante', prop: ['Duas Mãos', 'Pesada'], maestria: 'Garantido', peso: '3 kg', custo: '50 PO' },
  'Espada Longa': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Cortante', prop: ['Versátil (1d10)'], maestria: 'Drenar', peso: '1,5 kg', custo: '15 PO' },
  'Glaive': { categoria: 'Marcial Corpo a Corpo', dano: '1d10 Cortante', prop: ['Duas Mãos', 'Extensão', 'Pesada'], maestria: 'Garantido', peso: '3 kg', custo: '20 PO' },
  'Lança de Montaria': { categoria: 'Marcial Corpo a Corpo', dano: '1d10 Perfurante', prop: ['Duas Mãos (a menos que montado)', 'Extensão', 'Pesada'], maestria: 'Derrubar', peso: '3 kg', custo: '10 PO' },
  'Lança Longa': { categoria: 'Marcial Corpo a Corpo', dano: '1d10 Perfurante', prop: ['Duas Mãos', 'Extensão', 'Pesada'], maestria: 'Empurrar', peso: '9 kg', custo: '5 PO' },
  'Maça Estrela': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Perfurante', prop: [], maestria: 'Drenar', peso: '2 kg', custo: '15 PO' },
  'Machado de Batalha': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Cortante', prop: ['Versátil (1d10)'], maestria: 'Derrubar', peso: '2,5 kg', custo: '10 PO' },
  'Machado Grande': { categoria: 'Marcial Corpo a Corpo', dano: '1d12 Cortante', prop: ['Duas Mãos', 'Pesada'], maestria: 'Trespassar', peso: '3,5 kg', custo: '30 PO' },
  'Malho': { categoria: 'Marcial Corpo a Corpo', dano: '2d6 Contundente', prop: ['Duas Mãos', 'Pesada'], maestria: 'Derrubar', peso: '5 kg', custo: '10 PO' },
  'Mangual': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Contundente', prop: [], maestria: 'Drenar', peso: '1 kg', custo: '10 PO' },
  'Martelo de Guerra': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Contundente', prop: ['Versátil (1d10)'], maestria: 'Empurrar', peso: '1 kg', custo: '15 PO' },
  'Picareta de Guerra': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Perfurante', prop: ['Versátil (1d10)'], maestria: 'Drenar', peso: '1 kg', custo: '5 PO' },
  'Rapieira': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Perfurante', prop: ['Acuidade'], maestria: 'Afligir', peso: '1 kg', custo: '25 PO' },
  'Tridente': { categoria: 'Marcial Corpo a Corpo', dano: '1d8 Perfurante', prop: ['Arremesso (6/18)', 'Versátil (1d10)'], maestria: 'Derrubar', peso: '2 kg', custo: '5 PO' },
  'Arco Longo': { categoria: 'Marcial à Distância', dano: '1d8 Perfurante', prop: ['Duas Mãos', 'Munição (45/180; Flecha)', 'Pesada'], maestria: 'Lentidão', peso: '1 kg', custo: '50 PO' },
  'Besta de Mão': { categoria: 'Marcial à Distância', dano: '1d6 Perfurante', prop: ['Leve', 'Munição (9/36; Virote)', 'Recarga'], maestria: 'Afligir', peso: '1,5 kg', custo: '75 PO' },
  'Besta Pesada': { categoria: 'Marcial à Distância', dano: '1d10 Perfurante', prop: ['Duas Mãos', 'Munição (30/120; Virote)', 'Pesada', 'Recarga'], maestria: 'Empurrar', peso: '9 kg', custo: '50 PO' },
};

function getProficientWeaponNames(className) {
  const names = Object.keys(WEAPONS);
  if (className === 'Guerreiro') return names; // Simples e Marciais, todas
  if (className === 'Ladino') return names.filter(n => {
    const w = WEAPONS[n];
    const isSimple = w.categoria.startsWith('Simples');
    const hasFinesseOrLight = w.prop.some(p => p.startsWith('Acuidade') || p.startsWith('Leve'));
    return isSimple || hasFinesseOrLight;
  });
  return names;
}

/* ---- Armaduras ---- */
const ARMOR = {
  'Acolchoada': { categoria: 'Leve', ca: 'DES', forca: null, furtividade: true, peso: '4 kg', custo: '5 PO' },
  'Couro': { categoria: 'Leve', ca: 'DES', forca: null, furtividade: false, peso: '5 kg', custo: '10 PO' },
  'Couro Batido': { categoria: 'Leve', ca: 'DES', base: 12, forca: null, furtividade: false, peso: '6,5 kg', custo: '45 PO' },
  'Gibão de Peles': { categoria: 'Média', ca: 'DES-max2', base: 12, forca: null, furtividade: false, peso: '6 kg', custo: '10 PO' },
  'Cota de Malha Parcial': { categoria: 'Média', ca: 'DES-max2', base: 13, forca: null, furtividade: false, peso: '10 kg', custo: '50 PO' },
  'Loriga de Escamas': { categoria: 'Média', ca: 'DES-max2', base: 14, forca: null, furtividade: true, peso: '22 kg', custo: '50 PO' },
  'Couraça Peitoral': { categoria: 'Média', ca: 'DES-max2', base: 14, forca: null, furtividade: false, peso: '10 kg', custo: '400 PO' },
  'Placas Parcial': { categoria: 'Média', ca: 'DES-max2', base: 15, forca: null, furtividade: true, peso: '20 kg', custo: '750 PO' },
  'Cota de Anéis': { categoria: 'Pesada', ca: 'fixo', base: 14, forca: null, furtividade: true, peso: '20 kg', custo: '30 PO' },
  'Cota de Malha': { categoria: 'Pesada', ca: 'fixo', base: 16, forca: 13, furtividade: true, peso: '27 kg', custo: '75 PO' },
  'Armadura de Talas': { categoria: 'Pesada', ca: 'fixo', base: 17, forca: 15, furtividade: true, peso: '30 kg', custo: '200 PO' },
  'Placas': { categoria: 'Pesada', ca: 'fixo', base: 18, forca: 15, furtividade: true, peso: '32 kg', custo: '1.500 PO' },
};

function calcAC(armorName, dexMod, hasShield) {
  let ac;
  if (!armorName) {
    ac = 10 + dexMod;
  } else {
    const a = ARMOR[armorName];
    if (a.categoria === 'Leve') ac = (a.base || 11) + dexMod;
    else if (a.categoria === 'Média') ac = a.base + Math.min(dexMod, 2);
    else ac = a.base; // Pesada: fixo
  }
  if (hasShield) ac += 2;
  return ac;
}

const TOOL_VARIANTS = {
  'Ferramentas de Artesão': ['Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo', 'Ferramentas de Coureiro', 'Ferramentas de Entalhador', 'Ferramentas de Ferreiro', 'Ferramentas de Funileiro', 'Ferramentas de Joalheiro', 'Ferramentas de Oleiro', 'Ferramentas de Pedreiro', 'Ferramentas de Sapateiro', 'Ferramentas de Tecelão', 'Ferramentas de Vidreiro'],
  'Instrumento Musical': ['Alaúde', 'Flauta', 'Flauta de Pan', 'Gaita de Foles', 'Lira', 'Oboé', 'Tambor', 'Trombeta', 'Violino', 'Xilofone'],
  'Kit de Jogos': ['Dados', 'Xadrez-do-Dragão', 'Baralho de Cartas', 'Conjunto do Jogo dos Três Dragões'],
};

/* ---- Talentos de Origem (um por antecedente) ---- */
const ORIGIN_FEATS = {
  'Alerta': { texto: 'Proficiência em Iniciativa: pode adicionar seu Bônus de Proficiência à jogada de Iniciativa. Troca de Iniciativa: logo após rolar Iniciativa, pode trocar com a de um aliado voluntário (nenhum dos dois pode estar Incapacitado).' },
  'Artifista': { texto: 'Proficiência com três Ferramentas de Artesão à sua escolha. Desconto de 20% ao comprar itens não mágicos. Fabricação Rápida: em um Descanso Longo, fabrica um item temporário (tabela Fabricação Rápida) usando as ferramentas — dura até seu próximo Descanso Longo.', escolha: { tipo: 'ferramentas', categoria: 'Ferramentas de Artesão', qtd: 3 } },
  'Atacante Selvagem': { texto: 'Uma vez por turno, ao atingir um alvo com uma arma, pode jogar os dados de dano da arma duas vezes e usar qualquer um dos resultados.' },
  'Curandeiro': { texto: 'Médico de Combate: com um Kit de Curandeiro, gasta um uso para curar uma criatura próxima (ela gasta um Dado de Vida + seu Bônus de Proficiência em PV). Cura Garantida: pode rejogar resultados de 1 em dados de cura.' },
  'Habilidoso': { texto: 'Proficiência em qualquer combinação de três perícias ou ferramentas à sua escolha.', escolha: { tipo: 'pericias-ou-ferramentas', qtd: 3 } },
  'Iniciado em Magia': { texto: 'Aprende 2 truques e 1 magia de 1º círculo de uma lista de magias (Clérigo, Druida ou Mago). A magia de 1º círculo fica sempre preparada (1x/dia grátis, ou com espaço de magia).', escolha: { tipo: 'lista-magia', qtd: 1 } },
  'Músico': { texto: 'Proficiência com três Instrumentos Musicais à sua escolha. Canção Encorajadora: em um Descanso Curto ou Longo, concede Inspiração Heroica a um número de aliados igual ao seu Bônus de Proficiência.', escolha: { tipo: 'ferramentas', categoria: 'Instrumento Musical', qtd: 3 } },
  'Sortudo': { texto: 'Pontos de Sorte = seu Bônus de Proficiência. Gaste 1 para ter Vantagem em um teste de D20 seu, ou para impor Desvantagem num ataque contra você. Restaura em Descanso Longo.' },
  'Valentão de Taverna': { texto: 'Ataque Desarmado causa 1d4 + mod. de Força (Contundente). Pode rejogar 1s no dano. Proficiência com armas improvisadas. Ao acertar Ataque Desarmado, pode empurrar o alvo 1,5m (1x/turno).' },
  'Vigoroso': { texto: 'PV máximos aumentam em 2× seu nível de personagem ao adquirir o talento, e mais 2 a cada nível seguinte.' },
};

/* ---- Talentos de Estilo de Luta (usados pelo Guerreiro) ---- */
const FIGHTING_STYLES = {
  'Arquearia': '+2 nas jogadas de ataque com armas à Distância.',
  'Combate com Armas de Arremesso': '+2 na jogada de dano com armas que tenham a propriedade Arremesso.',
  'Combate com Armas Grandes': 'Em armas Corpo a Corpo de duas mãos (Duas Mãos ou Versátil), trate 1s e 2s no dado de dano como 3.',
  'Combate com Duas Armas': 'Some seu modificador de atributo ao dano do ataque adicional com arma Leve.',
  'Combate Desarmado': 'Ataque Desarmado causa 1d6 + Força (1d8 se sem arma/escudo em mãos); 1d4 extra em criatura Imobilizada por você.',
  'Defensivo': '+1 na Classe de Armadura enquanto estiver usando qualquer armadura.',
  'Duelismo': '+2 no dano ao empunhar uma arma Corpo a Corpo em uma mão e nenhuma outra arma.',
  'Interceptação': 'Reação: reduz em 1d10 + Bônus de Proficiência o dano sofrido por um aliado próximo (precisa de Escudo ou arma).',
  'Luta às Cegas': 'Visão às Cegas com alcance de 3 metros.',
  'Protetivo': 'Reação: impõe Desvantagem no ataque contra um aliado próximo (precisa estar com Escudo).',
};

/* ---- Antecedentes (16) ---- */
const BACKGROUNDS = [
  { nome: 'Acólito', atributos: ['Inteligência', 'Sabedoria', 'Carisma'], talento: 'Iniciado em Magia', talentoRotulo: 'Iniciado em Magia (Clérigo)', pericias: ['Intuição', 'Religião'], ferramenta: 'Suprimentos de Calígrafo', equipA: ['Suprimentos de Calígrafo', 'Livro (orações)', 'Símbolo Sagrado', 'Pergaminho (10 folhas)', 'Túnica', '8 PO'], flavor: 'Serviu em um templo, aprendendo a canalizar poder divino.' },
  { nome: 'Andarilho', atributos: ['Destreza', 'Sabedoria', 'Carisma'], talento: 'Sortudo', talentoRotulo: 'Sortudo', pericias: ['Furtividade', 'Intuição'], ferramenta: 'Ferramentas de Ladrão', equipA: ['2 Adagas', 'Ferramentas de Ladrão', 'Kit de Jogos (qualquer)', '2 Algibeiras', 'Roupas de Viagem', 'Saco de Dormir', '16 PO'], flavor: 'Cresceu nas ruas, sobrevivendo por conta própria.' },
  { nome: 'Artesão', atributos: ['Força', 'Destreza', 'Inteligência'], talento: 'Artifista', talentoRotulo: 'Artifista', pericias: ['Investigação', 'Persuasão'], ferramenta: 'ESCOLHA:Ferramentas de Artesão', equipA: ['Ferramentas de Artesão (a escolhida)', '2 Algibeiras', 'Roupas de Viagem', '32 PO'], flavor: 'Aprendeu um ofício na oficina de um artesão.' },
  { nome: 'Artista', atributos: ['Força', 'Destreza', 'Carisma'], talento: 'Músico', talentoRotulo: 'Músico', pericias: ['Acrobacia', 'Atuação'], ferramenta: 'ESCOLHA:Instrumento Musical', equipA: ['Instrumento Musical (o escolhido)', 'Espelho', '2 Fantasias', 'Perfume', 'Roupas de Viagem', '11 PO'], flavor: 'Rodou feiras e festivais, aprendendo a se apresentar.' },
  { nome: 'Charlatão', atributos: ['Destreza', 'Constituição', 'Carisma'], talento: 'Habilidoso', talentoRotulo: 'Habilidoso', pericias: ['Enganação', 'Prestidigitação'], ferramenta: 'Kit de Falsificação', equipA: ['Kit de Falsificação', 'Fantasia', 'Roupas Finas', '15 PO'], flavor: 'Percorreu tavernas lidando com trapaças e mentiras confortantes.' },
  { nome: 'Criminoso', atributos: ['Destreza', 'Constituição', 'Inteligência'], talento: 'Alerta', talentoRotulo: 'Alerta', pericias: ['Furtividade', 'Prestidigitação'], ferramenta: 'Ferramentas de Ladrão', equipA: ['2 Adagas', 'Ferramentas de Ladrão', '2 Algibeiras', 'Pé de Cabra', 'Roupas de Viagem', '16 PO'], flavor: 'Sobreviveu em becos escuros, sozinho ou em uma gangue.' },
  { nome: 'Eremita', atributos: ['Constituição', 'Sabedoria', 'Carisma'], talento: 'Curandeiro', talentoRotulo: 'Curandeiro', pericias: ['Medicina', 'Religião'], ferramenta: 'Kit de Herbalismo', equipA: ['Cajado', 'Kit de Herbalismo', 'Lâmpada', 'Livro (filosofia)', 'Óleo (3 frascos)', 'Roupas de Viagem', 'Saco de Dormir', '16 PO'], flavor: 'Viveu isolado, ponderando os mistérios da criação.' },
  { nome: 'Escriba', atributos: ['Destreza', 'Inteligência', 'Sabedoria'], talento: 'Habilidoso', talentoRotulo: 'Habilidoso', pericias: ['Investigação', 'Percepção'], ferramenta: 'Suprimentos de Calígrafo', equipA: ['Suprimentos de Calígrafo', 'Lâmpada', 'Óleo (3 frascos)', 'Pergaminho (12 folhas)', 'Roupas Finas', '23 PO'], flavor: 'Formou-se em um scriptorium, preservando o conhecimento escrito.' },
  { nome: 'Fazendeiro', atributos: ['Força', 'Constituição', 'Sabedoria'], talento: 'Vigoroso', talentoRotulo: 'Vigoroso', pericias: ['Lidar com Animais', 'Natureza'], ferramenta: 'Ferramentas de Carpinteiro', equipA: ['Foice', 'Ferramentas de Carpinteiro', 'Kit de Curandeiro', 'Balde de Ferro', 'Pá', '30 PO'], flavor: 'Cresceu perto da terra, cuidando de animais e plantações.' },
  { nome: 'Guarda', atributos: ['Força', 'Inteligência', 'Sabedoria'], talento: 'Alerta', talentoRotulo: 'Alerta', pericias: ['Atletismo', 'Percepção'], ferramenta: 'ESCOLHA:Kit de Jogos', equipA: ['Lança', 'Besta Leve', '20 Virotes', 'Kit de Jogo (o escolhido)', 'Aljava', 'Grilhões', 'Lanterna Coberta', 'Roupas de Viagem', '12 PO'], flavor: 'Treinado para vigiar muralhas, dentro e fora.' },
  { nome: 'Guia', atributos: ['Destreza', 'Constituição', 'Sabedoria'], talento: 'Iniciado em Magia', talentoRotulo: 'Iniciado em Magia (Druida)', pericias: ['Furtividade', 'Sobrevivência'], ferramenta: 'Ferramentas de Cartógrafo', equipA: ['Arco Curto', '20 Flechas', 'Ferramentas de Cartógrafo', 'Aljava', 'Roupas de Viagem', 'Saco de Dormir', 'Tenda', '3 PO'], flavor: 'Cresceu ao ar livre, aprendendo a se defender na natureza.' },
  { nome: 'Marinheiro', atributos: ['Força', 'Destreza', 'Sabedoria'], talento: 'Valentão de Taverna', talentoRotulo: 'Valentão de Taverna', pericias: ['Acrobacia', 'Percepção'], ferramenta: 'Ferramentas de Navegador', equipA: ['Adaga', 'Ferramentas de Navegador', 'Corda', 'Roupas de Viagem', '20 PO'], flavor: 'Viveu com o vento nas costas, em mais portos do que lembra.' },
  { nome: 'Mercador', atributos: ['Constituição', 'Inteligência', 'Carisma'], talento: 'Sortudo', talentoRotulo: 'Sortudo', pericias: ['Lidar com Animais', 'Persuasão'], ferramenta: 'Ferramentas de Navegador', equipA: ['Ferramentas de Navegador', '2 Algibeiras', 'Roupas de Viagem', '22 PO'], flavor: 'Aprendeu os fundamentos do comércio como aprendiz.' },
  { nome: 'Nobre', atributos: ['Força', 'Inteligência', 'Carisma'], talento: 'Habilidoso', talentoRotulo: 'Habilidoso', pericias: ['História', 'Persuasão'], ferramenta: 'ESCOLHA:Kit de Jogos', equipA: ['Kit de Jogos (o escolhido)', 'Perfume', 'Roupas Finas', '29 PO'], flavor: 'Criado em um castelo, cercado de riqueza e privilégio.' },
  { nome: 'Sábio', atributos: ['Constituição', 'Inteligência', 'Sabedoria'], talento: 'Iniciado em Magia', talentoRotulo: 'Iniciado em Magia (Mago)', pericias: ['Arcanismo', 'História'], ferramenta: 'Suprimentos de Calígrafo', equipA: ['Cajado', 'Suprimentos de Calígrafo', 'Livro (história)', 'Pergaminho (8 folhas)', 'Túnica', '8 PO'], flavor: 'Viajou entre mosteiros e mansões em troca de acesso a bibliotecas.' },
  { nome: 'Soldado', atributos: ['Força', 'Destreza', 'Constituição'], talento: 'Atacante Selvagem', talentoRotulo: 'Atacante Selvagem', pericias: ['Atletismo', 'Intimidação'], ferramenta: 'ESCOLHA:Kit de Jogos', equipA: ['Lança', 'Arco Curto', '20 Flechas', 'Kit de Curandeiro', 'Kit de Jogo (o escolhido)', 'Aljava', 'Roupas de Viagem', '14 PO'], flavor: 'Treinou para a guerra desde a idade adulta.' },
];

/* ---- Espécies (piloto: Humano e Anão) ---- */
const SPECIES = {
  'Humano': {
    tamanho: 'Médio ou Pequeno (você escolhe)', deslocamento: 9,
    tracos: [
      { nome: 'Eficiente', texto: 'Você adquire Inspiração Heroica sempre que completa um Descanso Longo.' },
      { nome: 'Hábil', texto: 'Você adquire proficiência em uma perícia à sua escolha.', escolha: { tipo: 'pericia', qtd: 1 } },
      { nome: 'Versátil', texto: 'Você adquire um talento de Origem à sua escolha (Habilidoso é recomendado).', escolha: { tipo: 'talento-origem', qtd: 1 } },
    ],
  },
  'Anão': {
    tamanho: 'Médio (cerca de 1,20-1,50m)', deslocamento: 9,
    tracos: [
      { nome: 'Visão no Escuro', texto: 'Alcance de 36 metros.' },
      { nome: 'Resistência a Toxinas', texto: 'Resistência a dano Venenoso. Vantagem em salvaguardas contra a condição Envenenado.' },
      { nome: 'Tenacidade Anã', texto: 'Seus PV máximos aumentam em 1, e novamente em 1 a cada nível de personagem.' },
      { nome: 'Conhecimento de Pedras', texto: 'Ação Bônus: Sismiconsciência (alcance 18m) por 10 minutos, precisa estar tocando pedra. Usos = Bônus de Proficiência; recarrega em Descanso Longo.' },
    ],
  },
};

/* ---- Classes (piloto: Guerreiro e Ladino) ---- */
const CLASSES = {
  'Guerreiro': {
    atributoPrimario: 'Força ou Destreza', dadoVida: 10, salvaguardas: ['Força', 'Constituição'],
    periciasEscolha: 2,
    periciasOpcoes: ['Acrobacia', 'Atletismo', 'História', 'Intimidação', 'Intuição', 'Lidar com Animais', 'Percepção', 'Persuasão', 'Sobrevivência'],
    profArmas: 'Armas Simples e Marciais', profArmadura: 'Armaduras Leves, Médias e Pesadas, e Escudos',
    maestriaArmaQtd: 3,
    equipamento: [
      { id: 'A', itens: ['Cota de Malha', 'Espada Grande', 'Mangual', '8 Azagaias', 'Kit de Explorador de Masmorras'], po: 4 },
      { id: 'B', itens: ['Armadura de Couro Batido', 'Cimitarra', 'Espada Curta', 'Arco Longo', '20 Flechas', 'Aljava', 'Kit de Explorador de Masmorras'], po: 11 },
      { id: 'C', itens: [], po: 155 },
    ],
    tracos1: [
      { nome: 'Estilo de Luta', texto: 'Você tem um talento de Estilo de Luta à sua escolha.', escolha: { tipo: 'estilo-luta', qtd: 1 } },
      { nome: 'Maestria em Arma', texto: 'Pode usar as propriedades de maestria de três tipos de armas Simples ou Marciais à sua escolha (entre as quais tem proficiência).', escolha: { tipo: 'maestria-arma', qtd: 3 } },
      { nome: 'Recuperar Fôlego', texto: 'Ação Bônus: recupera 1d10 + seu nível de Guerreiro em Pontos de Vida. 2 usos — recupera 1 uso em Descanso Curto, todos em Descanso Longo.' },
    ],
    flavor: 'Guerreiros dominam inúmeros campos de batalha: armas, armaduras e táticas de combate.',
  },
  'Ladino': {
    atributoPrimario: 'Destreza', dadoVida: 8, salvaguardas: ['Destreza', 'Inteligência'],
    periciasEscolha: 4,
    periciasOpcoes: ['Acrobacia', 'Atletismo', 'Enganação', 'Furtividade', 'Intimidação', 'Intuição', 'Investigação', 'Percepção', 'Persuasão', 'Prestidigitação'],
    profArmas: 'Armas Simples, e Marciais com propriedade Acuidade ou Leve', profArmadura: 'Armadura Leve',
    maestriaArmaQtd: 2,
    equipamento: [
      { id: 'A', itens: ['Armadura de Couro', '2 Adagas', 'Espada Curta', 'Arco Curto', '20 Flechas', 'Aljava', 'Ferramentas de Ladrão', 'Kit de Assaltante'], po: 8 },
      { id: 'B', itens: [], po: 100 },
    ],
    tracos1: [
      { nome: 'Ataque Furtivo', texto: 'Uma vez por turno, ao atingir com Vantagem usando arma com Acuidade ou à Distância, +1d6 de dano adicional (também vale sem Vantagem, se um aliado estiver a 1,5m do alvo e você não tiver Desvantagem).' },
      { nome: 'Especialista', texto: 'Você obtém Especialização (dobro do Bônus de Proficiência) em duas perícias nas quais já é proficiente.', escolha: { tipo: 'especialista', qtd: 2 } },
      { nome: 'Gíria do Ladrão', texto: 'Você conhece a Gíria dos Ladrões e mais um idioma à sua escolha.', escolha: { tipo: 'idioma-extra', qtd: 1 } },
      { nome: 'Maestria em Arma', texto: 'Duas armas à sua escolha (entre as quais tem proficiência) usam suas propriedades de maestria.', escolha: { tipo: 'maestria-arma', qtd: 2 } },
    ],
    flavor: 'Ladinos confiam na astúcia, furtividade e nas fraquezas dos inimigos para obter vantagem.',
  },
};

/* =========================================================================
   HELPERS
   ========================================================================= */

const TOOLS_ALL = [
  ...TOOL_VARIANTS['Ferramentas de Artesão'],
  ...TOOL_VARIANTS['Instrumento Musical'],
  ...TOOL_VARIANTS['Kit de Jogos'],
  'Ferramentas de Ladrão', 'Suprimentos de Calígrafo', 'Kit de Herbalismo', 'Ferramentas de Navegador', 'Kit de Falsificação',
];

const REPEATABLE_FEATS = ['Habilidoso', 'Iniciado em Magia'];

// alterna um valor dentro de um array, respeitando um máximo — sempre puro, sem depender de estado externo
function toggleInArray(prevArr, value, max) {
  const arr = prevArr || [];
  if (arr.includes(value)) return arr.filter(x => x !== value);
  if (arr.length < max) return [...arr, value];
  return arr;
}

function slugify(s) {
  return (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function rollD6() { return 1 + Math.floor(Math.random() * 6); }
function roll4d6DropLowest() {
  const r = [rollD6(), rollD6(), rollD6(), rollD6()].sort((a, b) => a - b);
  return r[1] + r[2] + r[3];
}
function rollSixScores() {
  return Array.from({ length: 6 }, roll4d6DropLowest).sort((a, b) => b - a);
}

function emptyChar() {
  return {
    classe: null, especie: null, especieTamanho: null, antecedente: null, idiomas: [],
    metodoAtributos: null, atributosBase: {}, poolAtributos: null,
    bonusAntecedente: null, // { tipo:'2-1', mais, menos } | { tipo:'1-1-1' }
    alinhamento: null,
    periciasClasse: [], antecedenteFerramentaEscolha: null, antecedenteEquipamentoEscolha: null,
    humanoTamanho: null, humanoPericia: null, humanoTalento: null,
    talentoOrigemEscolha: [], // usado por Habilidoso (3 perícias/ferramentas) e Artifista/Músico (3 ferramentas)
    humanoTalentoEscolha: [], // idem, se o talento extra do Humano tiver escolha própria
    magiaIniciadoNota: '',
    especialistaEscolha: [], estiloLutaEscolha: null, maestriaArmaEscolha: [], giriaIdiomaExtra: null,
    equipamentoEscolha: null,
    nome: '', aparencia: '',
  };
}

function abilitiesFromBackground(bg) {
  return bg ? bg.atributos : [];
}

// perícias que o personagem já teria de graça (antecedente + traço Hábil do Humano) — evita duplicar escolha de classe
function freeSkills(char) {
  const bg = BACKGROUNDS.find(b => b.nome === char.antecedente);
  const s = new Set();
  if (bg) bg.pericias.forEach(p => s.add(p));
  if (char.especie === 'Humano' && char.humanoPericia) s.add(char.humanoPericia);
  return s;
}

// todas as perícias com proficiência (para oferecer como opção de Especialização do Ladino)
function proficientSkills(char) {
  const s = new Set([...char.periciasClasse, ...freeSkills(char)]);
  if (char.talentoOrigemEscolha) char.talentoOrigemEscolha.forEach(x => { if (SKILLS[x]) s.add(x); });
  return Array.from(s);
}

function finalScores(char) {
  const out = {};
  ABILITIES.forEach(a => { out[a] = char.atributosBase[a] || 8; });
  if (char.bonusAntecedente) {
    if (char.bonusAntecedente.tipo === '2-1') {
      out[char.bonusAntecedente.mais] = Math.min(20, out[char.bonusAntecedente.mais] + 2);
      out[char.bonusAntecedente.menos] = Math.min(20, out[char.bonusAntecedente.menos] + 1);
    } else if (char.bonusAntecedente.tipo === '1-1-1') {
      abilitiesFromBackground(BACKGROUNDS.find(b => b.nome === char.antecedente)).forEach(a => {
        out[a] = Math.min(20, out[a] + 1);
      });
    }
  }
  return out;
}

const EQUIP_ARMOR = {
  Guerreiro: { A: 'Cota de Malha', B: 'Armadura de Couro Batido', C: null },
  Ladino: { A: 'Couro', B: null },
};

/* =========================================================================
   PERSISTÊNCIA (window.storage)
   ========================================================================= */

async function loadCharacter(slug) {
  try {
    const r = await window.storage.get('personagem:' + slug, true);
    return r ? JSON.parse(r.value) : null;
  } catch (e) { return null; }
}
async function saveCharacter(slug, playerName, char) {
  try {
    await window.storage.set('personagem:' + slug, JSON.stringify({ jogador: playerName, ...char, _atualizado: Date.now() }), true);
  } catch (e) { /* silencioso — tentaremos de novo na próxima mudança */ }
}
async function listCharacters() {
  try {
    const r = await window.storage.list('personagem:', true);
    if (!r || !r.keys) return [];
    const out = [];
    for (const k of r.keys) {
      try {
        const v = await window.storage.get(k, true);
        if (v) out.push(JSON.parse(v.value));
      } catch (e) { /* pula chave problemática */ }
    }
    return out;
  } catch (e) { return []; }
}
async function getGmPassword() {
  try { const r = await window.storage.get('senha-mestre', true); return r ? r.value : null; } catch (e) { return null; }
}
async function setGmPassword(pw) {
  try { await window.storage.set('senha-mestre', pw, true); } catch (e) { /* noop */ }
}

/* =========================================================================
   ÁTOMOS DE INTERFACE
   ========================================================================= */

function Panel({ children, style }) {
  return <div className="pj-panel" style={style}>{children}</div>;
}

function Eyebrow({ children }) {
  return <div className="pj-eyebrow">{children}</div>;
}

function ChoiceCard({ selected, onClick, title, subtitle, meta, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={'pj-choice' + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '')}>
      <div className="pj-choice-title">{title}{selected && <span className="pj-check">✓</span>}</div>
      {subtitle && <div className="pj-choice-subtitle">{subtitle}</div>}
      {meta && <div className="pj-choice-meta">{meta}</div>}
    </button>
  );
}

function Tag({ children, tone }) {
  return <span className={'pj-tag' + (tone ? ' pj-tag-' + tone : '')}>{children}</span>;
}

function AbilityBox({ label, score, mod, small }) {
  return (
    <div className={'pj-ability-box' + (small ? ' is-small' : '')}>
      <div className="pj-ability-mod">{fmtMod(mod)}</div>
      <div className="pj-ability-label">{ABBR[label] || label}</div>
      <div className="pj-ability-score">{score}</div>
    </div>
  );
}

function NavButtons({ onBack, onNext, backLabel, nextLabel, nextDisabled }) {
  return (
    <div className="pj-nav">
      {onBack ? <button className="pj-btn pj-btn-ghost" onClick={onBack}>{backLabel || '← Voltar'}</button> : <span />}
      {onNext && <button className="pj-btn pj-btn-primary" onClick={onNext} disabled={nextDisabled}>{nextLabel || 'Continuar →'}</button>}
    </div>
  );
}

function MultiPick({ options, chosen, max, onToggle, renderLabel }) {
  return (
    <div className="pj-pick-grid">
      {options.map(opt => {
        const isChosen = chosen.includes(opt);
        const full = chosen.length >= max && !isChosen;
        return (
          <button type="button" key={opt} disabled={full}
            className={'pj-pick' + (isChosen ? ' is-selected' : '') + (full ? ' is-disabled' : '')}
            onClick={() => onToggle(opt)}>
            {renderLabel ? renderLabel(opt) : opt}
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   ESTILO GLOBAL
   ========================================================================= */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

      .pj-root {
        --paper: #EAE3D3; --paper-card: #F6F1E6; --ink: #2B2620; --ink-soft: #746A5A;
        --oxblood: #6E1F24; --oxblood-dark: #4E1519; --brass: #93701F; --line: #C9BCA0;
        --forest: #3B5240; --danger: #8C3B2E;
        background: var(--paper); color: var(--ink); font-family: 'Work Sans', sans-serif;
        min-height: 100%; position: relative;
        background-image: repeating-linear-gradient(180deg, rgba(43,38,32,0.035) 0px, rgba(43,38,32,0.035) 1px, transparent 1px, transparent 34px);
      }
      .pj-root * { box-sizing: border-box; }
      .pj-serif { font-family: 'Fraunces', serif; }
      .pj-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }

      .pj-shell { max-width: 980px; margin: 0 auto; padding: 20px 18px 60px; }
      .pj-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 18px; flex-wrap: wrap; }
      .pj-title { font-family: 'Fraunces', serif; font-size: 26px; font-weight: 600; color: var(--oxblood); letter-spacing: 0.2px; }
      .pj-sub { color: var(--ink-soft); font-size: 13px; }

      .pj-tabs { display: flex; gap: 2px; overflow-x: auto; border-bottom: 2px solid var(--line); margin-bottom: 22px; }
      .pj-tab { flex: none; padding: 10px 16px; font-size: 13px; font-weight: 600; color: var(--ink-soft); background: transparent; border: none; cursor: pointer; position: relative; white-space: nowrap; font-family: 'Work Sans', sans-serif; }
      .pj-tab.is-active { color: var(--oxblood); }
      .pj-tab.is-active::after { content: ''; position: absolute; left: 8px; right: 8px; bottom: -2px; height: 3px; background: var(--oxblood); border-radius: 2px 2px 0 0; }
      .pj-tab.is-done { color: var(--forest); }
      .pj-tab:disabled { color: #B7AD9A; cursor: not-allowed; }

      .pj-panel { background: var(--paper-card); border: 1px solid var(--line); border-radius: 4px; padding: 22px; box-shadow: 0 1px 0 rgba(43,38,32,0.06); }
      .pj-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--brass); margin-bottom: 6px; }
      .pj-step-title { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; margin: 0 0 4px; }
      .pj-step-desc { color: var(--ink-soft); font-size: 14px; margin-bottom: 18px; line-height: 1.5; }

      .pj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px; }
      .pj-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }
      .pj-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 640px) { .pj-grid.cols-3, .pj-grid.cols-2 { grid-template-columns: 1fr; } }

      .pj-choice { text-align: left; background: #fff; border: 1.5px solid var(--line); border-radius: 4px; padding: 12px 14px; cursor: pointer; transition: border-color .15s, background .15s; font-family: 'Work Sans', sans-serif; }
      .pj-choice:hover:not(.is-disabled) { border-color: var(--brass); }
      .pj-choice.is-selected { border-color: var(--oxblood); background: #FBF3EE; }
      .pj-choice.is-disabled { opacity: 0.45; cursor: not-allowed; }
      .pj-choice-title { font-weight: 700; font-size: 14.5px; display: flex; justify-content: space-between; align-items: center; }
      .pj-check { color: var(--oxblood); font-weight: 700; }
      .pj-choice-subtitle { color: var(--ink-soft); font-size: 12.5px; margin-top: 3px; }
      .pj-choice-meta { color: var(--brass); font-size: 11.5px; margin-top: 5px; font-family: 'IBM Plex Mono', monospace; }

      .pj-pick-grid { display: flex; flex-wrap: wrap; gap: 7px; }
      .pj-pick { border: 1.5px solid var(--line); background: #fff; border-radius: 20px; padding: 6px 13px; font-size: 12.5px; cursor: pointer; font-family: 'Work Sans', sans-serif; }
      .pj-pick.is-selected { border-color: var(--oxblood); background: var(--oxblood); color: #fff; }
      .pj-pick.is-disabled { opacity: 0.4; cursor: not-allowed; }

      .pj-tag { display: inline-block; font-size: 11px; font-family: 'IBM Plex Mono', monospace; border: 1px solid var(--line); border-radius: 3px; padding: 1px 7px; margin: 2px 4px 2px 0; color: var(--ink-soft); }
      .pj-tag-brass { border-color: var(--brass); color: var(--brass); }
      .pj-tag-forest { border-color: var(--forest); color: var(--forest); }
      .pj-tag-blood { border-color: var(--oxblood); color: var(--oxblood); }

      .pj-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 24px; }
      .pj-btn { font-family: 'Work Sans', sans-serif; font-weight: 600; font-size: 13.5px; padding: 10px 18px; border-radius: 3px; cursor: pointer; border: 1.5px solid transparent; }
      .pj-btn-primary { background: var(--oxblood); color: #fff; }
      .pj-btn-primary:hover:not(:disabled) { background: var(--oxblood-dark); }
      .pj-btn-primary:disabled { background: #C9BCA0; cursor: not-allowed; }
      .pj-btn-ghost { background: transparent; border-color: var(--line); color: var(--ink); }
      .pj-btn-ghost:hover { border-color: var(--ink-soft); }
      .pj-btn-small { padding: 6px 12px; font-size: 12px; }

      .pj-ability-box { border: 1.5px solid var(--ink); border-radius: 6px; width: 88px; padding: 8px 0 10px; text-align: center; background: #fff; position: relative; }
      .pj-ability-box.is-small { width: 68px; padding: 6px 0 7px; }
      .pj-ability-mod { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 19px; }
      .pj-ability-label { font-size: 10px; letter-spacing: 0.1em; color: var(--ink-soft); margin: 2px 0; }
      .pj-ability-score { font-family: 'IBM Plex Mono', monospace; font-size: 13px; border-top: 1px solid var(--line); margin: 0 14px; padding-top: 3px; }

      .pj-field { margin-bottom: 16px; }
      .pj-label { font-weight: 600; font-size: 13px; margin-bottom: 6px; display: block; }
      .pj-input, .pj-select, .pj-textarea { width: 100%; border: 1.5px solid var(--line); background: #fff; border-radius: 3px; padding: 9px 11px; font-family: 'Work Sans', sans-serif; font-size: 14px; color: var(--ink); }
      .pj-textarea { min-height: 70px; resize: vertical; }
      .pj-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

      .pj-divider { border: none; border-top: 1px solid var(--line); margin: 20px 0; }
      .pj-feature { border-left: 3px solid var(--brass); padding: 4px 0 4px 12px; margin-bottom: 12px; }
      .pj-feature-name { font-weight: 700; font-size: 13.5px; }
      .pj-feature-text { font-size: 13px; color: var(--ink-soft); line-height: 1.5; margin-top: 2px; }

      .pj-gate { max-width: 420px; margin: 10vh auto; }
      .pj-stepper-pts { font-family: 'IBM Plex Mono', monospace; }
      .pj-skillrow { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted var(--line); font-size: 13px; }
      .pj-skillrow .name { flex: 1; }
      .pj-skillrow .abbr { color: var(--ink-soft); width: 36px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
      .pj-skillrow .mod { font-family: 'IBM Plex Mono', monospace; font-weight: 600; width: 34px; text-align: right; }

      .pj-sheet-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 18px; }
      @media (max-width: 720px) { .pj-sheet-grid { grid-template-columns: 1fr; } }
      .pj-sheet-block { background: #fff; border: 1px solid var(--line); border-radius: 4px; padding: 14px; margin-bottom: 14px; }
      .pj-sheet-block h4 { font-family: 'Fraunces', serif; font-size: 15px; margin: 0 0 10px; color: var(--oxblood); }
    `}</style>
  );
}

/* =========================================================================
   MODO MESTRE
   ========================================================================= */

function GmLoginInline({ onEnter, onCancel }) {
  const [pw, setPw] = useState('');
  const [existing, setExisting] = useState(undefined); // undefined = carregando, null = ainda não definida
  const [err, setErr] = useState('');
  useEffect(() => { getGmPassword().then(setExisting); }, []);

  async function submit() {
    if (existing === undefined) return;
    if (existing === null) {
      if (!pw.trim()) { setErr('Digite uma senha para definir.'); return; }
      await setGmPassword(pw.trim());
      onEnter();
    } else if (pw === existing) {
      onEnter();
    } else {
      setErr('Senha incorreta.');
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--line)' }}>
      <div className="pj-label">{existing === null ? 'Defina uma senha de mestre (só uma vez)' : 'Senha de mestre'}</div>
      <input className="pj-input" type="password" value={pw} onChange={e => setPw(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); }} placeholder="senha" autoFocus />
      {err && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{err}</div>}
      <div className="pj-nav">
        <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={onCancel}>Cancelar</button>
        <button className="pj-btn pj-btn-primary pj-btn-small" onClick={submit}>Entrar</button>
      </div>
    </div>
  );
}

function GMPanel({ onExit }) {
  const [list, setList] = useState(null);
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(() => { setList(null); listCharacters().then(setList); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (selected) {
    return (
      <div>
        <div className="pj-nav" style={{ marginBottom: 10 }}>
          <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={() => setSelected(null)}>← Voltar pra lista</button>
          <span />
        </div>
        <Ficha char={selected} playerName={selected.jogador} readOnly />
      </div>
    );
  }

  return (
    <div>
      <div className="pj-header">
        <div className="pj-title">Modo Mestre</div>
        <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={onExit}>Sair do modo mestre</button>
      </div>
      <Panel>
        <Eyebrow>Mesa</Eyebrow>
        <div className="pj-step-title" style={{ fontSize: 18 }}>Personagens da mesa</div>
        {list === null && <div className="pj-step-desc">Carregando…</div>}
        {list && list.length === 0 && <div className="pj-step-desc">Nenhum personagem salvo ainda. Assim que um jogador começar, ele aparece aqui.</div>}
        {list && list.length > 0 && (
          <div className="pj-grid cols-2">
            {list.map(c => (
              <ChoiceCard key={c.jogador} onClick={() => setSelected(c)}
                title={c.nome || '(sem nome de personagem ainda)'}
                subtitle={`Jogador(a): ${c.jogador}`}
                meta={[c.especie, c.classe, c.antecedente].filter(Boolean).join(' · ') || 'ainda começando…'} />
            ))}
          </div>
        )}
        <div className="pj-nav">
          <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={refresh}>↻ Atualizar lista</button>
          <span />
        </div>
      </Panel>
    </div>
  );
}

/* =========================================================================
   PASSO 1 — CLASSE
   ========================================================================= */

function StepClasse({ char, update, onNext }) {
  return (
    <Panel>
      <Eyebrow>Passo 1 de 5</Eyebrow>
      <div className="pj-step-title">Escolha uma classe</div>
      <div className="pj-step-desc">A classe define o papel do seu personagem em combate e fora dele, e organiza boa parte das escolhas dos próximos passos.</div>
      <div className="pj-grid cols-2">
        {Object.keys(CLASSES).map(name => {
          const c = CLASSES[name];
          return (
            <ChoiceCard key={name} selected={char.classe === name} onClick={() => update({ classe: name })}
              title={name} subtitle={c.flavor}
              meta={`Dado de Vida d${c.dadoVida} · Atributo primário: ${c.atributoPrimario}`} />
          );
        })}
      </div>
      {char.classe && (
        <div style={{ marginTop: 18 }}>
          <hr className="pj-divider" />
          <div style={{ marginBottom: 6 }}><b>Proficiência em armas:</b> {CLASSES[char.classe].profArmas}</div>
          <div style={{ marginBottom: 6 }}><b>Proficiência em armaduras:</b> {CLASSES[char.classe].profArmadura}</div>
          <div><b>Salvaguardas:</b> {CLASSES[char.classe].salvaguardas.join(' e ')}</div>
        </div>
      )}
      <NavButtons onNext={onNext} nextDisabled={!char.classe} />
    </Panel>
  );
}

/* =========================================================================
   PASSO 4 — ALINHAMENTO
   ========================================================================= */

function StepAlinhamento({ char, update, onNext, onBack }) {
  return (
    <Panel>
      <Eyebrow>Passo 4 de 5</Eyebrow>
      <div className="pj-step-title">Escolha um alinhamento</div>
      <div className="pj-step-desc">Como seu personagem se relaciona com regras/tradição e com o bem-estar alheio. É uma bússola, não uma prisão.</div>
      <div className="pj-grid cols-3">
        {ALIGNMENTS.map(a => (
          <ChoiceCard key={a.code} selected={char.alinhamento === a.name} onClick={() => update({ alinhamento: a.name })}
            title={a.name} subtitle={a.desc} />
        ))}
      </div>
      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!char.alinhamento} />
    </Panel>
  );
}

/* =========================================================================
   PASSO 2 — ORIGEM (espécie + antecedente + idiomas)
   ========================================================================= */

function StepOrigem({ char, update, onNext, onBack }) {
  const bg = BACKGROUNDS.find(b => b.nome === char.antecedente);
  const needsToolChoice = bg && bg.ferramenta.startsWith('ESCOLHA:');
  const canNext = char.especie && char.antecedente && char.idiomas.length === 2 && (!needsToolChoice || char.antecedenteFerramentaEscolha);

  function toggleLang(lang) {
    update(prev => ({ idiomas: toggleInArray(prev.idiomas, lang, 2) }));
  }

  return (
    <Panel>
      <Eyebrow>Passo 2 de 5</Eyebrow>
      <div className="pj-step-title">Determine a origem</div>
      <div className="pj-step-desc">Origem = espécie + antecedente + idiomas. É a história de onde seu personagem veio.</div>

      <div className="pj-label" style={{ marginTop: 4 }}>Espécie</div>
      <div className="pj-grid cols-2" style={{ marginBottom: 20 }}>
        {Object.keys(SPECIES).map(name => (
          <ChoiceCard key={name} selected={char.especie === name} onClick={() => update({ especie: name })}
            title={name} subtitle={`Tamanho: ${SPECIES[name].tamanho} · Deslocamento ${SPECIES[name].deslocamento}m`}
            meta={SPECIES[name].tracos.map(t => t.nome).join(' · ')} />
        ))}
      </div>

      <div className="pj-label">Antecedente</div>
      <div className="pj-grid" style={{ marginBottom: 14 }}>
        {BACKGROUNDS.map(b => (
          <ChoiceCard key={b.nome} selected={char.antecedente === b.nome}
            onClick={() => update({ antecedente: b.nome, antecedenteFerramentaEscolha: null, antecedenteEquipamentoEscolha: null, bonusAntecedente: null })}
            title={b.nome} subtitle={b.atributos.join(' · ')} meta={`Talento: ${b.talentoRotulo}`} />
        ))}
      </div>
      {needsToolChoice && (
        <div className="pj-field">
          <div className="pj-label">{bg.nome}: escolha um tipo de {bg.ferramenta.replace('ESCOLHA:', '')}</div>
          <MultiPick options={TOOL_VARIANTS[bg.ferramenta.replace('ESCOLHA:', '')]}
            chosen={char.antecedenteFerramentaEscolha ? [char.antecedenteFerramentaEscolha] : []}
            max={1} onToggle={v => update({ antecedenteFerramentaEscolha: v })} />
        </div>
      )}

      <div className="pj-label" style={{ marginTop: 10 }}>Idiomas — você já conhece o Comum, escolha mais 2</div>
      <MultiPick options={LANGUAGES_COMMON} chosen={char.idiomas} max={2} onToggle={toggleLang} />

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </Panel>
  );
}

/* =========================================================================
   PASSO 3 — ATRIBUTOS
   ========================================================================= */

function StepAtributos({ char, update, onNext, onBack }) {
  const bg = BACKGROUNDS.find(b => b.nome === char.antecedente);
  const bgAbilities = bg ? bg.atributos : [];

  function chooseMethod(m) {
    if (m === 'pontos') {
      const base = {}; ABILITIES.forEach(a => base[a] = 8);
      update({ metodoAtributos: m, atributosBase: base, poolAtributos: null });
    } else if (m === 'padrao') {
      update({ metodoAtributos: m, atributosBase: {}, poolAtributos: [...STANDARD_ARRAY] });
    } else {
      update({ metodoAtributos: m, atributosBase: {}, poolAtributos: rollSixScores() });
    }
  }

  function assignPool(ability, value) {
    update(prev => ({ atributosBase: { ...prev.atributosBase, [ability]: value } }));
  }

  function usarSugestao() {
    const sug = STANDARD_ARRAY_BY_CLASS[char.classe];
    if (!sug || !char.poolAtributos) return;
    // ordena as habilidades pela prioridade sugerida pelo livro p/ essa classe, e distribui
    // o pool ATUAL (padrão ou rolado) nessa mesma ordem — assim funciona com qualquer método.
    const rankedAbilities = [...ABILITIES].sort((a, b) => sug[b] - sug[a]);
    const sortedPool = [...char.poolAtributos].sort((a, b) => b - a);
    const base = {};
    rankedAbilities.forEach((a, i) => { base[a] = sortedPool[i]; });
    update({ atributosBase: base });
  }

  const pointsUsed = char.metodoAtributos === 'pontos'
    ? ABILITIES.reduce((sum, a) => sum + (POINT_BUY_COST[char.atributosBase[a] || 8] || 0), 0)
    : 0;
  const pointsLeft = 27 - pointsUsed;

  const baseComplete = char.metodoAtributos && ABILITIES.every(a => char.atributosBase[a]);
  const bonusChosen = char.bonusAntecedente && (
    char.bonusAntecedente.tipo === '1-1-1' ||
    (char.bonusAntecedente.tipo === '2-1' && char.bonusAntecedente.mais && char.bonusAntecedente.menos && char.bonusAntecedente.mais !== char.bonusAntecedente.menos)
  );
  const canNext = baseComplete && bonusChosen;
  const fs = finalScores(char);

  return (
    <Panel>
      <Eyebrow>Passo 3 de 5</Eyebrow>
      <div className="pj-step-title">Determine os valores de atributo</div>
      <div className="pj-step-desc">Escolha um método para gerar os seis atributos base — depois some o bônus do seu antecedente.</div>

      <div className="pj-grid cols-3" style={{ marginBottom: 18 }}>
        <ChoiceCard selected={char.metodoAtributos === 'padrao'} onClick={() => chooseMethod('padrao')}
          title="Conjunto Padrão" subtitle="15, 14, 13, 12, 10, 8 — distribua como quiser." />
        <ChoiceCard selected={char.metodoAtributos === 'aleatorio'} onClick={() => chooseMethod('aleatorio')}
          title="Rolagem Aleatória" subtitle="4d6, descarta o menor, seis vezes." />
        <ChoiceCard selected={char.metodoAtributos === 'pontos'} onClick={() => chooseMethod('pontos')}
          title="Compra de Pontos" subtitle="27 pontos para distribuir (8 a 15 cada)." />
      </div>

      {(char.metodoAtributos === 'padrao' || char.metodoAtributos === 'aleatorio') && char.poolAtributos && (
        <div className="pj-field">
          <div className="pj-row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="pj-label" style={{ margin: 0 }}>Distribua: {char.poolAtributos.join(', ')}</div>
            <div className="pj-row" style={{ gap: 8 }}>
              {char.classe && <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={usarSugestao}>Usar sugestão p/ {char.classe}</button>}
              {char.metodoAtributos === 'aleatorio' && <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={() => update({ poolAtributos: rollSixScores(), atributosBase: {} })}>🎲 Rolar de novo</button>}
            </div>
          </div>
          <div className="pj-grid cols-3">
            {ABILITIES.map(a => {
              const used = ABILITIES.filter(x => x !== a).map(x => char.atributosBase[x]).filter(Boolean);
              const options = char.poolAtributos.filter(v => !used.includes(v) || v === char.atributosBase[a]);
              return (
                <div key={a} className="pj-field" style={{ marginBottom: 6 }}>
                  <label className="pj-label">{a}</label>
                  <select className="pj-select" value={char.atributosBase[a] || ''} onChange={e => assignPool(a, Number(e.target.value))}>
                    <option value="">—</option>
                    {options.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {char.metodoAtributos === 'pontos' && (
        <div className="pj-field">
          <div className="pj-label pj-stepper-pts">Pontos restantes: {pointsLeft} / 27</div>
          <div className="pj-grid cols-3">
            {ABILITIES.map(a => {
              const v = char.atributosBase[a] || 8;
              const nextCost = v < 15 ? POINT_BUY_COST[v + 1] - POINT_BUY_COST[v] : Infinity;
              return (
                <div key={a} className="pj-field" style={{ marginBottom: 6 }}>
                  <label className="pj-label">{a}</label>
                  <div className="pj-row" style={{ gap: 8 }}>
                    <button className="pj-btn pj-btn-ghost pj-btn-small" disabled={v <= 8} onClick={() => assignPool(a, v - 1)}>−</button>
                    <span className="pj-mono" style={{ width: 26, textAlign: 'center', fontWeight: 700 }}>{v}</span>
                    <button className="pj-btn pj-btn-ghost pj-btn-small" disabled={v >= 15 || nextCost > pointsLeft} onClick={() => assignPool(a, v + 1)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {baseComplete && bg && (
        <div className="pj-field">
          <hr className="pj-divider" />
          <div className="pj-label">Bônus do antecedente ({bg.nome}: {bgAbilities.join(', ')})</div>
          <div className="pj-step-desc" style={{ marginTop: -6 }}>+2 em um desses três atributos e +1 em outro, ou +1 nos três.</div>
          <div className="pj-row" style={{ gap: 10, marginBottom: 10 }}>
            <button className={'pj-pick' + (char.bonusAntecedente?.tipo === '2-1' ? ' is-selected' : '')}
              onClick={() => update({ bonusAntecedente: { tipo: '2-1', mais: null, menos: null } })}>+2 / +1</button>
            <button className={'pj-pick' + (char.bonusAntecedente?.tipo === '1-1-1' ? ' is-selected' : '')}
              onClick={() => update({ bonusAntecedente: { tipo: '1-1-1' } })}>+1 / +1 / +1</button>
          </div>
          {char.bonusAntecedente?.tipo === '2-1' && (
            <div className="pj-row" style={{ gap: 24 }}>
              <div>
                <div className="pj-label">+2 em:</div>
                <MultiPick options={bgAbilities} chosen={char.bonusAntecedente.mais ? [char.bonusAntecedente.mais] : []} max={1}
                  onToggle={v => update(prev => ({ bonusAntecedente: { ...prev.bonusAntecedente, mais: v, menos: prev.bonusAntecedente.menos === v ? null : prev.bonusAntecedente.menos } }))} />
              </div>
              <div>
                <div className="pj-label">+1 em:</div>
                <MultiPick options={bgAbilities.filter(a => a !== char.bonusAntecedente.mais)} chosen={char.bonusAntecedente.menos ? [char.bonusAntecedente.menos] : []} max={1}
                  onToggle={v => update(prev => ({ bonusAntecedente: { ...prev.bonusAntecedente, menos: v } }))} />
              </div>
            </div>
          )}
        </div>
      )}

      {canNext && (
        <div className="pj-field">
          <hr className="pj-divider" />
          <div className="pj-label">Resultado final</div>
          <div className="pj-row" style={{ gap: 10 }}>
            {ABILITIES.map(a => <AbilityBox key={a} label={a} score={fs[a]} mod={abilityMod(fs[a])} />)}
          </div>
        </div>
      )}

      <NavButtons onBack={onBack} onNext={onNext} nextDisabled={!canNext} />
    </Panel>
  );
}

/* =========================================================================
   Resolve escolhas embutidas em um talento (Habilidoso, Artifista, Músico, Iniciado em Magia)
   ========================================================================= */

function FeatExtra({ featKey, label, chosen, onToggle, note, onNoteChange }) {
  const feat = ORIGIN_FEATS[featKey];
  if (!feat || !feat.escolha) return null;
  const esc = feat.escolha;
  if (esc.tipo === 'lista-magia') {
    return (
      <div className="pj-field">
        <div className="pj-label">{label || featKey}: anote sua escolha com o Mestre</div>
        <div className="pj-step-desc" style={{ marginTop: -8 }}>Escolha 2 truques e 1 magia de 1º círculo (lista de Clérigo, Druida ou Mago). O capítulo de magias ainda não faz parte deste piloto — anote aqui o que combinar com o Mestre.</div>
        <input className="pj-input" value={note || ''} onChange={e => onNoteChange(e.target.value)} placeholder="ex: truques Luz e Prestidigitação; magia Enfeitiçar Pessoa (lista de Mago)" />
      </div>
    );
  }
  const options = esc.tipo === 'ferramentas' ? TOOL_VARIANTS[esc.categoria]
    : esc.tipo === 'pericias-ou-ferramentas' ? [...Object.keys(SKILLS), ...TOOLS_ALL]
      : [];
  return (
    <div className="pj-field">
      <div className="pj-label">{label || featKey}: escolha {esc.qtd}</div>
      <MultiPick options={options} chosen={chosen} max={esc.qtd} onToggle={onToggle} />
    </div>
  );
}

function featExtraComplete(featKey, chosen, note) {
  const feat = ORIGIN_FEATS[featKey];
  if (!feat || !feat.escolha) return true;
  if (feat.escolha.tipo === 'lista-magia') return !!(note && note.trim());
  return (chosen || []).length === feat.escolha.qtd;
}

/* =========================================================================
   PASSO 5 — DETALHES
   ========================================================================= */

function StepDetalhes({ char, update, onNext, onBack }) {
  const bg = BACKGROUNDS.find(b => b.nome === char.antecedente);
  const cls = CLASSES[char.classe];
  const isHumano = char.especie === 'Humano';
  const free = freeSkills(char);
  const skillOptions = cls.periciasOpcoes.filter(p => !free.has(p));
  const habilOptions = Object.keys(SKILLS).filter(s => !free.has(s) && s !== char.antecedenteFerramentaEscolha);
  const versatilOptions = Object.keys(ORIGIN_FEATS).filter(f => f !== bg?.talento || REPEATABLE_FEATS.includes(f));
  const profWeapons = getProficientWeaponNames(char.classe);
  const profSkillsNow = proficientSkills({ ...char }); // já inclui periciasClasse + free + talentoOrigemEscolha

  function toggleClassSkill(s) {
    update(prev => ({ periciasClasse: toggleInArray(prev.periciasClasse, s, cls.periciasEscolha) }));
  }
  function toggleMulti(field, value, max) {
    update(prev => ({ [field]: toggleInArray(prev[field], value, max) }));
  }
  function toggleFeatChoice(field, value, qtd) {
    update(prev => ({ [field]: toggleInArray(prev[field], value, qtd) }));
  }

  const skillsDone = char.periciasClasse.length === cls.periciasEscolha;
  const bgFeatChoiceDone = bg ? featExtraComplete(bg.talento, char.talentoOrigemEscolha, char.magiaIniciadoNota) : true;
  const humanoDone = !isHumano || (char.humanoTamanho && char.humanoPericia && char.humanoTalento && featExtraComplete(char.humanoTalento, char.humanoTalentoEscolha, char.magiaIniciadoNota));
  const classeChoicesDone = char.classe === 'Guerreiro'
    ? (char.estiloLutaEscolha && char.maestriaArmaEscolha.length === cls.maestriaArmaQtd)
    : (char.especialistaEscolha.length === 2 && char.maestriaArmaEscolha.length === cls.maestriaArmaQtd && char.giriaIdiomaExtra);
  const equipDone = char.equipamentoEscolha && char.antecedenteEquipamentoEscolha;
  const canNext = skillsDone && bgFeatChoiceDone && humanoDone && classeChoicesDone && equipDone && char.nome.trim();

  return (
    <Panel>
      <Eyebrow>Passo 5 de 5</Eyebrow>
      <div className="pj-step-title">Preencha os detalhes</div>
      <div className="pj-step-desc">Últimas escolhas: perícias, talentos, equipamento e a identidade do personagem.</div>

      {/* Perícias de classe */}
      <div className="pj-field">
        <div className="pj-label">Perícias de {char.classe} — escolha {cls.periciasEscolha} ({char.periciasClasse.length}/{cls.periciasEscolha})</div>
        {free.size > 0 && <div className="pj-step-desc" style={{ marginTop: -6 }}>Já garantidas pelo antecedente: {Array.from(free).join(', ')} (não contam aqui).</div>}
        <MultiPick options={skillOptions} chosen={char.periciasClasse} max={cls.periciasEscolha} onToggle={toggleClassSkill} />
      </div>

      <hr className="pj-divider" />

      {/* Talento do antecedente */}
      {bg && (
        <div className="pj-field">
          <div className="pj-label">Talento de origem (do antecedente {bg.nome})</div>
          <div className="pj-feature">
            <div className="pj-feature-name">{bg.talentoRotulo}</div>
            <div className="pj-feature-text">{ORIGIN_FEATS[bg.talento].texto}</div>
          </div>
          <FeatExtra featKey={bg.talento} chosen={char.talentoOrigemEscolha}
            onToggle={v => toggleFeatChoice('talentoOrigemEscolha', v, ORIGIN_FEATS[bg.talento].escolha?.qtd)}
            note={char.magiaIniciadoNota} onNoteChange={v => update({ magiaIniciadoNota: v })} />
        </div>
      )}

      {/* Traços de Humano */}
      {isHumano && (
        <>
          <hr className="pj-divider" />
          <div className="pj-field">
            <div className="pj-label">Traços de Humano</div>
            <div className="pj-row" style={{ gap: 20, marginBottom: 14 }}>
              <div>
                <div className="pj-label">Tamanho</div>
                <MultiPick options={['Médio', 'Pequeno']} chosen={char.humanoTamanho ? [char.humanoTamanho] : []} max={1}
                  onToggle={v => update({ humanoTamanho: v })} />
              </div>
            </div>
            <div className="pj-feature">
              <div className="pj-feature-name">Hábil</div>
              <div className="pj-feature-text">{SPECIES.Humano.tracos[1].texto}</div>
            </div>
            <MultiPick options={habilOptions} chosen={char.humanoPericia ? [char.humanoPericia] : []} max={1}
              onToggle={v => update({ humanoPericia: v })} />

            <div className="pj-feature" style={{ marginTop: 14 }}>
              <div className="pj-feature-name">Versátil — talento de origem extra</div>
              <div className="pj-feature-text">{SPECIES.Humano.tracos[2].texto}</div>
            </div>
            <MultiPick options={versatilOptions} chosen={char.humanoTalento ? [char.humanoTalento] : []} max={1}
              onToggle={v => update({ humanoTalento: v, humanoTalentoEscolha: [] })} />
            {char.humanoTalento && (
              <div className="pj-feature" style={{ marginTop: 8 }}>
                <div className="pj-feature-text">{ORIGIN_FEATS[char.humanoTalento].texto}</div>
              </div>
            )}
            {char.humanoTalento && (
              <FeatExtra featKey={char.humanoTalento} label={char.humanoTalento + ' (Versátil)'} chosen={char.humanoTalentoEscolha}
                onToggle={v => toggleFeatChoice('humanoTalentoEscolha', v, ORIGIN_FEATS[char.humanoTalento].escolha?.qtd)} note={char.magiaIniciadoNota} onNoteChange={v => update({ magiaIniciadoNota: v })} />
            )}
          </div>
        </>
      )}

      <hr className="pj-divider" />

      {/* Traços de classe nível 1 com escolha */}
      <div className="pj-field">
        <div className="pj-label">Características de {char.classe} (nível 1)</div>
        {cls.tracos1.map(t => (
          <div className="pj-feature" key={t.nome}>
            <div className="pj-feature-name">{t.nome}</div>
            <div className="pj-feature-text">{t.texto}</div>
          </div>
        ))}

        {char.classe === 'Guerreiro' && (
          <>
            <div className="pj-label" style={{ marginTop: 10 }}>Estilo de Luta</div>
            <MultiPick options={Object.keys(FIGHTING_STYLES)} chosen={char.estiloLutaEscolha ? [char.estiloLutaEscolha] : []} max={1}
              onToggle={v => update({ estiloLutaEscolha: v })}
              renderLabel={v => v} />
            {char.estiloLutaEscolha && <div className="pj-feature-text" style={{ marginTop: 6 }}>{FIGHTING_STYLES[char.estiloLutaEscolha]}</div>}
          </>
        )}

        <div className="pj-label" style={{ marginTop: 14 }}>
          Maestria em Arma — escolha {cls.maestriaArmaQtd} ({char.maestriaArmaEscolha.length}/{cls.maestriaArmaQtd})
        </div>
        <MultiPick options={profWeapons} chosen={char.maestriaArmaEscolha} max={cls.maestriaArmaQtd}
          onToggle={v => toggleMulti('maestriaArmaEscolha', v, cls.maestriaArmaQtd)}
          renderLabel={v => `${v} (${WEAPONS[v].maestria})`} />

        {char.classe === 'Ladino' && (
          <>
            <div className="pj-label" style={{ marginTop: 14 }}>Especialista — escolha 2 perícias já proficientes para dobrar o bônus</div>
            <MultiPick options={profSkillsNow} chosen={char.especialistaEscolha} max={2}
              onToggle={v => toggleMulti('especialistaEscolha', v, 2)} />

            <div className="pj-label" style={{ marginTop: 14 }}>Gíria do Ladrão — idioma extra (além da Gíria dos Ladrões)</div>
            <MultiPick options={LANGUAGES_COMMON.filter(l => !char.idiomas.includes(l))} chosen={char.giriaIdiomaExtra ? [char.giriaIdiomaExtra] : []} max={1}
              onToggle={v => update({ giriaIdiomaExtra: v })} />
          </>
        )}
      </div>

      <hr className="pj-divider" />

      {/* Equipamento */}
      <div className="pj-field">
        <div className="pj-label">Equipamento inicial — antecedente ({bg?.nome})</div>
        <div className="pj-grid cols-2">
          <ChoiceCard selected={char.antecedenteEquipamentoEscolha === 'A'} onClick={() => update({ antecedenteEquipamentoEscolha: 'A' })}
            title="Opção A — itens" subtitle={bg?.equipA.join(', ')} />
          <ChoiceCard selected={char.antecedenteEquipamentoEscolha === 'B'} onClick={() => update({ antecedenteEquipamentoEscolha: 'B' })}
            title="Opção B — só ouro" subtitle="Sem itens" meta="50 PO" />
        </div>
      </div>
      <div className="pj-field">
        <div className="pj-label">Equipamento inicial — classe ({char.classe})</div>
        <div className="pj-grid cols-3">
          {cls.equipamento.map(opt => (
            <ChoiceCard key={opt.id} selected={char.equipamentoEscolha === opt.id} onClick={() => update({ equipamentoEscolha: opt.id })}
              title={`Opção ${opt.id}`} subtitle={opt.itens.length ? opt.itens.join(', ') : 'Sem itens — compre por conta própria'}
              meta={`${opt.po} PO`} />
          ))}
        </div>
      </div>

      <hr className="pj-divider" />

      {/* Identidade */}
      <div className="pj-field">
        <label className="pj-label">Nome do personagem</label>
        <input className="pj-input" value={char.nome} onChange={e => update({ nome: e.target.value })} placeholder="ex: Bram Pedraverde" />
      </div>
      <div className="pj-field">
        <label className="pj-label">Aparência / personalidade (opcional)</label>
        <textarea className="pj-textarea" value={char.aparencia} onChange={e => update({ aparencia: e.target.value })} placeholder="como seu personagem é, por fora e por dentro…" />
      </div>

      <NavButtons onBack={onBack} onNext={onNext} nextLabel="Ver ficha →" nextDisabled={!canNext} />
    </Panel>
  );
}

/* =========================================================================
   FICHA FINAL
   ========================================================================= */

function describeChoice(featKey, chosenArr, note) {
  const feat = ORIGIN_FEATS[featKey];
  if (!feat || !feat.escolha) return null;
  if (feat.escolha.tipo === 'lista-magia') return note ? note : '(não preenchido)';
  return chosenArr && chosenArr.length ? chosenArr.join(', ') : '(não preenchido)';
}

// identifica armas dentro da lista de equipamento (que tem prefixos de quantidade, ex: "8 Azagaias")
// e calcula o bônus de ataque/dano corretos (Acuidade usa o melhor de For/Des; à distância usa Des; resto usa For)
function weaponAttacksFromEquipment(items, mods, profBonus) {
  const found = []; const seen = new Set();
  for (const item of items) {
    for (const key of Object.keys(WEAPONS)) {
      if (item.includes(key) && !seen.has(key)) {
        seen.add(key);
        const w = WEAPONS[key];
        const isFinesse = w.prop.some(p => p.startsWith('Acuidade'));
        const isRanged = w.categoria.includes('Distância');
        const usedMod = isFinesse ? Math.max(mods.Força, mods.Destreza) : isRanged ? mods.Destreza : mods.Força;
        const [dice, ...tipoParts] = w.dano.split(' ');
        found.push({ nome: key, bonus: fmtMod(usedMod + profBonus), dano: `${dice}${fmtMod(usedMod)} ${tipoParts.join(' ')}`.trim(), maestria: w.maestria });
      }
    }
  }
  return found;
}

// toda a matemática derivada do personagem, num só lugar — usado tanto pela tela interativa quanto pelo PDF/print
function computeSheetData(char) {
  const cls = CLASSES[char.classe];
  const bg = BACKGROUNDS.find(b => b.nome === char.antecedente);
  const sp = SPECIES[char.especie];
  if (!cls || !bg || !sp) return null;

  const fs = finalScores(char);
  const mods = {}; ABILITIES.forEach(a => mods[a] = abilityMod(fs[a]));
  const profBonus = 2;

  const hasAlerta = bg.talento === 'Alerta' || char.humanoTalento === 'Alerta';
  const hasVigoroso = bg.talento === 'Vigoroso' || char.humanoTalento === 'Vigoroso';

  let hp = cls.dadoVida + mods.Constituição;
  if (char.especie === 'Anão') hp += 1;
  if (hasVigoroso) hp += 2;
  hp = Math.max(1, hp);

  const armorKey = char.equipamentoEscolha ? EQUIP_ARMOR[char.classe][char.equipamentoEscolha] : null;
  const ac = calcAC(armorKey, mods.Destreza, false);
  const initiative = mods.Destreza + (hasAlerta ? profBonus : 0);

  const allSkillsProf = proficientSkills(char);
  const expertiseSkills = char.especialistaEscolha || [];
  const percMod = mods.Sabedoria + (expertiseSkills.includes('Percepção') ? profBonus * 2 : allSkillsProf.includes('Percepção') ? profBonus : 0);

  const equipA = char.antecedenteEquipamentoEscolha === 'A' ? (bg.equipA || []) : [];
  const classEquip = char.equipamentoEscolha ? cls.equipamento.find(o => o.id === char.equipamentoEscolha) : null;
  const goldTotal = (char.antecedenteEquipamentoEscolha === 'B' ? 50 : 0) + (classEquip ? classEquip.po : 0);
  const equipItems = [...equipA, ...(classEquip ? classEquip.itens : [])];

  const languages = ['Comum', ...(char.idiomas || []), ...(char.classe === 'Ladino' ? ['Gíria dos Ladrões', char.giriaIdiomaExtra].filter(Boolean) : [])];
  const attacks = weaponAttacksFromEquipment(equipItems, mods, profBonus);

  const toolProfs = [
    ...(bg.ferramenta && !bg.ferramenta.startsWith('ESCOLHA:') ? [bg.ferramenta] : []),
    ...(char.antecedenteFerramentaEscolha ? [char.antecedenteFerramentaEscolha] : []),
    ...(char.classe === 'Ladino' ? ['Ferramentas de Ladrão'] : []),
  ];

  const featuresList = [
    ...sp.tracos.map(t => ({
      nome: t.nome, texto: t.texto,
      extra: t.nome === 'Hábil' ? char.humanoPericia : t.nome === 'Versátil' ? `${char.humanoTalento}${describeChoice(char.humanoTalento, char.humanoTalentoEscolha, char.magiaIniciadoNota) ? ' — ' + describeChoice(char.humanoTalento, char.humanoTalentoEscolha, char.magiaIniciadoNota) : ''}` : null,
    })),
    ...cls.tracos1.map(t => ({
      nome: t.nome, texto: t.texto,
      extra: t.nome === 'Estilo de Luta' ? `${char.estiloLutaEscolha} — ${FIGHTING_STYLES[char.estiloLutaEscolha]}`
        : t.nome === 'Maestria em Arma' ? char.maestriaArmaEscolha.map(w => `${w} (${WEAPONS[w].maestria})`).join(', ')
        : t.nome === 'Especialista' ? char.especialistaEscolha.join(', ')
        : t.nome === 'Gíria do Ladrão' ? char.giriaIdiomaExtra
        : null,
    })),
    { nome: bg.talentoRotulo, texto: ORIGIN_FEATS[bg.talento].texto, extra: describeChoice(bg.talento, char.talentoOrigemEscolha, char.magiaIniciadoNota) },
  ];

  return { cls, bg, sp, fs, mods, profBonus, hp, ac, initiative, allSkillsProf, expertiseSkills, percMod, equipA, classEquip, goldTotal, equipItems, languages, attacks, toolProfs, featuresList };
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// gera um documento HTML autônomo (fontes, estilos e dados embutidos) no estilo de uma ficha clássica de D&D,
// pra baixar e abrir direto no navegador → Ctrl+P / Cmd+P → Salvar como PDF. Não depende de nada do artifact.
function buildPrintableHTML(char, playerName, d) {
  const abilityBoxes = ABILITIES.map(a => `
    <div class="ab-box">
      <div class="ab-mod">${fmtMod(d.mods[a])}</div>
      <div class="ab-label">${ABBR[a]}</div>
      <div class="ab-score">${d.fs[a]}</div>
    </div>`).join('');

  const saves = ABILITIES.map(a => {
    const prof = d.cls.salvaguardas.includes(a);
    return `<div class="row"><span class="dot ${prof ? 'on' : ''}"></span><span class="rn">${a}</span><span class="rv">${fmtMod(d.mods[a] + (prof ? d.profBonus : 0))}</span></div>`;
  }).join('');

  const skills = Object.keys(SKILLS).sort().map(s => {
    const ability = SKILLS[s];
    const expert = d.expertiseSkills.includes(s);
    const prof = d.allSkillsProf.includes(s);
    const bonus = expert ? d.profBonus * 2 : prof ? d.profBonus : 0;
    return `<div class="row"><span class="dot ${prof ? 'on' : ''} ${expert ? 'expert' : ''}"></span><span class="rn">${s} <i>(${ABBR[ability]})</i></span><span class="rv">${fmtMod(d.mods[ability] + bonus)}</span></div>`;
  }).join('');

  const attacksRows = d.attacks.length
    ? d.attacks.map(a => `<tr><td>${a.nome}</td><td>${a.bonus}</td><td>${a.dano}</td><td>${a.maestria}</td></tr>`).join('')
    : `<tr><td colspan="4" class="muted">Nenhuma arma identificada no equipamento</td></tr>`;

  const equipmentLines = d.equipItems.map(it => `<li>${escapeHtml(it)}</li>`).join('');

  const featuresHtml = d.featuresList.map(f => `
    <div class="feat">
      <div class="feat-name">${escapeHtml(f.nome)}</div>
      <div class="feat-text">${escapeHtml(f.texto)}${f.extra ? ` <b>— ${escapeHtml(f.extra)}</b>` : ''}</div>
    </div>`).join('');

  const profLine = [d.cls.profArmas, d.cls.profArmadura, ...d.toolProfs].filter(Boolean).map(escapeHtml).join(' · ');

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>${escapeHtml(char.nome || 'Ficha de Personagem')}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
  :root{--ink:#2B2620;--soft:#6B6255;--blood:#6E1F24;--brass:#93701F;--line:#C9BCA0;--paper:#F8F4E9;}
  *{box-sizing:border-box;}
  @page{size:A4;margin:11mm;}
  body{font-family:'Work Sans',Arial,sans-serif;color:var(--ink);margin:0;padding:22px;background:#fff;font-size:12px;line-height:1.35;}
  .toolbar{background:var(--blood);color:#fff;padding:10px 16px;border-radius:6px;margin-bottom:16px;font-family:'Work Sans',sans-serif;font-size:13px;display:flex;justify-content:space-between;align-items:center;}
  .toolbar button{background:#fff;color:var(--blood);border:none;border-radius:4px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:13px;}
  @media print{.toolbar{display:none;}body{padding:0;}}
  h1{font-family:'Fraunces',serif;font-size:26px;margin:0;color:var(--blood);}
  .sub{color:var(--soft);font-size:12px;margin-top:2px;}
  .sub b{color:var(--ink);}
  header{border-bottom:2px solid var(--blood);padding-bottom:8px;margin-bottom:12px;}
  .grid{display:grid;grid-template-columns:100px 150px 1fr;gap:14px;align-items:start;}
  .ab-box{border:1.5px solid var(--ink);border-radius:6px;text-align:center;padding:6px 0 7px;margin-bottom:8px;}
  .ab-mod{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:17px;}
  .ab-label{font-size:9px;letter-spacing:.08em;color:var(--soft);}
  .ab-score{font-family:'IBM Plex Mono',monospace;font-size:11px;border-top:1px solid var(--line);margin:0 10px;padding-top:2px;}
  .block{border:1px solid var(--line);border-radius:5px;padding:8px 10px;margin-bottom:10px;background:var(--paper);}
  .block h3{font-family:'Fraunces',serif;font-size:12.5px;margin:0 0 6px;color:var(--blood);border-bottom:1px solid var(--line);padding-bottom:3px;}
  .row{display:flex;align-items:center;gap:5px;padding:1.5px 0;font-size:10.6px;border-bottom:1px dotted var(--line);}
  .rn{flex:1;} .rn i{color:var(--soft);font-style:normal;font-size:9px;}
  .rv{font-family:'IBM Plex Mono',monospace;font-weight:600;width:26px;text-align:right;}
  .dot{width:8px;height:8px;border:1.3px solid var(--ink);border-radius:50%;flex:none;}
  .dot.on{background:var(--blood);border-color:var(--blood);}
  .dot.expert{background:var(--brass);border-color:var(--brass);box-shadow:0 0 0 2px #fff, 0 0 0 3px var(--brass);}
  .strip{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:10px;}
  .stat{border:1.5px solid var(--ink);border-radius:6px;text-align:center;padding:6px 2px;}
  .stat .v{font-family:'IBM Plex Mono',monospace;font-weight:700;font-size:16px;}
  .stat .l{font-size:8px;color:var(--soft);letter-spacing:.05em;}
  table{width:100%;border-collapse:collapse;font-size:10.5px;}
  table td{padding:2px 4px;border-bottom:1px dotted var(--line);}
  table td:first-child{font-weight:600;}
  .muted{color:var(--soft);font-style:italic;}
  ul{margin:0;padding-left:16px;}
  li{font-size:10.6px;margin-bottom:1px;}
  .feat{margin-bottom:6px;page-break-inside:avoid;}
  .feat-name{font-weight:700;font-size:11px;}
  .feat-text{font-size:10.3px;color:#413C33;line-height:1.4;}
  .features-wrap{column-count:2;column-gap:18px;margin-top:12px;}
  footer{margin-top:14px;text-align:center;font-size:9px;color:var(--soft);}
</style></head>
<body>
  <div class="toolbar">
    <span>📄 Pronta pra virar PDF: use <b>Ctrl+P</b> (Windows/Linux) ou <b>Cmd+P</b> (Mac) e escolha "Salvar como PDF".</span>
    <button onclick="window.print()">Imprimir / Salvar PDF</button>
  </div>
  <header>
    <h1>${escapeHtml(char.nome || '(sem nome)')}</h1>
    <div class="sub"><b>${escapeHtml(playerName)}</b> · ${escapeHtml(char.especie)}${char.humanoTamanho ? ` (${escapeHtml(char.humanoTamanho)})` : ''} · ${escapeHtml(char.classe)} de nível 1 · Antecedente: ${escapeHtml(char.antecedente)} · ${escapeHtml(char.alinhamento)}</div>
  </header>

  <div class="strip">
    <div class="stat"><div class="v">${d.ac}</div><div class="l">CLASSE DE ARMADURA</div></div>
    <div class="stat"><div class="v">${fmtMod(d.initiative)}</div><div class="l">INICIATIVA</div></div>
    <div class="stat"><div class="v">${d.sp.deslocamento}m</div><div class="l">DESLOCAMENTO</div></div>
    <div class="stat"><div class="v">${d.hp}</div><div class="l">PV MÁXIMO</div></div>
    <div class="stat"><div class="v">1d${d.cls.dadoVida}</div><div class="l">DADO DE VIDA</div></div>
    <div class="stat"><div class="v">${10 + d.percMod}</div><div class="l">PERCEPÇÃO PASSIVA</div></div>
  </div>

  <div class="grid">
    <div>${abilityBoxes}</div>
    <div>
      <div class="block"><h3>Salvaguardas</h3>${saves}</div>
      <div class="block"><h3>Idiomas</h3><div style="font-size:10.6px;">${escapeHtml(d.languages.join(', '))}</div></div>
    </div>
    <div>
      <div class="block"><h3>Perícias</h3>${skills}</div>
    </div>
  </div>

  <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:10px;">
    <div class="block">
      <h3>Ataques</h3>
      <table><tr><td>Arma</td><td>Bônus</td><td>Dano</td><td>Maestria</td></tr>${attacksRows}</table>
    </div>
    <div class="block">
      <h3>Equipamento · ${d.goldTotal} PO</h3>
      <ul>${equipmentLines}</ul>
    </div>
  </div>

  <div class="block" style="margin-top:10px;">
    <h3>Proficiências</h3>
    <div style="font-size:10.6px;">${profLine}</div>
  </div>

  <div class="block" style="margin-top:10px;">
    <h3>Características e Talentos</h3>
    <div class="features-wrap">${featuresHtml}</div>
  </div>

  ${char.aparencia ? `<div class="block" style="margin-top:10px;"><h3>Aparência &amp; Personalidade</h3><div style="font-size:10.6px;">${escapeHtml(char.aparencia)}</div></div>` : ''}

  <footer>Ficha gerada no Criador de Personagens · D&amp;D 5ª Edição (2024) · Livro do Jogador</footer>
</body></html>`;
}

function downloadPrintableSheet(char, playerName, d) {
  const html = buildPrintableHTML(char, playerName, d);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(char.nome) || 'personagem'}-ficha.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Ficha({ char, playerName, onBack, readOnly }) {
  const d = computeSheetData(char);
  if (!d) {
    return <Panel><div className="pj-step-desc">Personagem ainda incompleto — volte às etapas anteriores.</div></Panel>;
  }
  const { cls, bg, sp, fs, mods, profBonus, hp, ac, initiative, allSkillsProf, expertiseSkills, percMod, equipA, classEquip, goldTotal, languages } = d;

  return (
    <Panel>
      <Eyebrow>Ficha de Personagem</Eyebrow>
      <div className="pj-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div className="pj-step-title" style={{ marginBottom: 0 }}>{char.nome || '(sem nome)'}</div>
          <div className="pj-sub">{playerName} · {char.especie} {char.humanoTamanho ? `(${char.humanoTamanho})` : ''} {char.classe} · Antecedente: {char.antecedente} · {char.alinhamento}</div>
        </div>
        <button className="pj-btn pj-btn-primary pj-btn-small" onClick={() => downloadPrintableSheet(char, playerName, d)}>⬇ Baixar ficha (PDF)</button>
      </div>
      <div className="pj-step-desc" style={{ marginTop: -2 }}>Baixa um arquivo — abra ele no navegador e use Ctrl+P (Cmd+P no Mac) → "Salvar como PDF".</div>
      {char.aparencia && <div className="pj-step-desc" style={{ fontStyle: 'italic' }}>{char.aparencia}</div>}

      <hr className="pj-divider" />

      <div className="pj-sheet-grid">
        <div>
          <div className="pj-row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {ABILITIES.map(a => <AbilityBox key={a} label={a} score={fs[a]} mod={mods[a]} small />)}
          </div>

          <div className="pj-sheet-block">
            <h4>Combate</h4>
            <div className="pj-skillrow"><span className="name">Pontos de Vida</span><span className="mod">{hp}</span></div>
            <div className="pj-skillrow"><span className="name">Classe de Armadura</span><span className="mod">{ac}</span></div>
            <div className="pj-skillrow"><span className="name">Iniciativa</span><span className="mod">{fmtMod(initiative)}</span></div>
            <div className="pj-skillrow"><span className="name">Deslocamento</span><span className="mod">{sp.deslocamento}m</span></div>
            <div className="pj-skillrow"><span className="name">Percepção Passiva</span><span className="mod">{10 + percMod}</span></div>
            <div className="pj-skillrow"><span className="name">Bônus de Proficiência</span><span className="mod">+2</span></div>
          </div>

          <div className="pj-sheet-block">
            <h4>Salvaguardas</h4>
            {ABILITIES.map(a => {
              const isProf = cls.salvaguardas.includes(a);
              return <div className="pj-skillrow" key={a}><span className="name">{isProf ? '● ' : '　'}{a}</span><span className="mod">{fmtMod(mods[a] + (isProf ? profBonus : 0))}</span></div>;
            })}
          </div>

          <div className="pj-sheet-block">
            <h4>Idiomas</h4>
            <div>{languages.join(', ')}</div>
          </div>
        </div>

        <div>
          <div className="pj-sheet-block">
            <h4>Perícias</h4>
            {Object.keys(SKILLS).sort().map(skill => {
              const ability = SKILLS[skill];
              const isExpert = expertiseSkills.includes(skill);
              const isProf = allSkillsProf.includes(skill);
              const bonus = isExpert ? profBonus * 2 : isProf ? profBonus : 0;
              return (
                <div className="pj-skillrow" key={skill}>
                  <span className="name">{isExpert ? '●● ' : isProf ? '● ' : '　'}{skill}</span>
                  <span className="abbr">{ABBR[ability]}</span>
                  <span className="mod">{fmtMod(mods[ability] + bonus)}</span>
                </div>
              );
            })}
          </div>

          <div className="pj-sheet-block">
            <h4>Traços de {char.especie}</h4>
            {sp.tracos.map(t => (
              <div className="pj-feature" key={t.nome}>
                <div className="pj-feature-name">{t.nome}</div>
                <div className="pj-feature-text">{t.texto}</div>
                {t.nome === 'Hábil' && <div className="pj-feature-text"><b>Escolhido:</b> {char.humanoPericia}</div>}
                {t.nome === 'Versátil' && <div className="pj-feature-text"><b>Escolhido:</b> {char.humanoTalento} {describeChoice(char.humanoTalento, char.humanoTalentoEscolha, char.magiaIniciadoNota) && `— ${describeChoice(char.humanoTalento, char.humanoTalentoEscolha, char.magiaIniciadoNota)}`}</div>}
              </div>
            ))}
          </div>

          <div className="pj-sheet-block">
            <h4>Características de {char.classe} (nível 1)</h4>
            {cls.tracos1.map(t => (
              <div className="pj-feature" key={t.nome}>
                <div className="pj-feature-name">{t.nome}</div>
                <div className="pj-feature-text">{t.texto}</div>
                {t.nome === 'Estilo de Luta' && <div className="pj-feature-text"><b>Escolhido:</b> {char.estiloLutaEscolha} — {FIGHTING_STYLES[char.estiloLutaEscolha]}</div>}
                {t.nome === 'Maestria em Arma' && <div className="pj-feature-text"><b>Escolhidas:</b> {char.maestriaArmaEscolha.map(w => `${w} (${WEAPONS[w].maestria}: ${WEAPON_MASTERY_DEFS[WEAPONS[w].maestria]})`).join(' · ')}</div>}
                {t.nome === 'Especialista' && <div className="pj-feature-text"><b>Escolhidas:</b> {char.especialistaEscolha.join(', ')}</div>}
                {t.nome === 'Gíria do Ladrão' && <div className="pj-feature-text"><b>Idioma extra:</b> {char.giriaIdiomaExtra}</div>}
              </div>
            ))}
          </div>

          <div className="pj-sheet-block">
            <h4>Talento de Origem</h4>
            <div className="pj-feature">
              <div className="pj-feature-name">{bg.talentoRotulo}</div>
              <div className="pj-feature-text">{ORIGIN_FEATS[bg.talento].texto}</div>
              {describeChoice(bg.talento, char.talentoOrigemEscolha, char.magiaIniciadoNota) && (
                <div className="pj-feature-text"><b>Escolhido:</b> {describeChoice(bg.talento, char.talentoOrigemEscolha, char.magiaIniciadoNota)}</div>
              )}
            </div>
          </div>

          <div className="pj-sheet-block">
            <h4>Equipamento</h4>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              {[...equipA, ...(classEquip ? classEquip.itens : [])].map((it, i) => <div key={i}>· {it}</div>)}
              <div className="pj-mono" style={{ marginTop: 6, fontWeight: 600 }}>Ouro: {goldTotal} PO</div>
              {bg.ferramenta && !bg.ferramenta.startsWith('ESCOLHA:') && <div style={{ marginTop: 4 }}>Ferramenta: {bg.ferramenta}</div>}
              {char.antecedenteFerramentaEscolha && <div style={{ marginTop: 4 }}>Ferramenta: {char.antecedenteFerramentaEscolha}</div>}
              {char.classe === 'Ladino' && <div style={{ marginTop: 4 }}>Ferramenta: Ferramentas de Ladrão</div>}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && <NavButtons onBack={onBack} backLabel="← Editar detalhes" />}
    </Panel>
  );
}

/* =========================================================================
   APP
   ========================================================================= */

const STEP_LABELS = ['Classe', 'Origem', 'Atributos', 'Alinhamento', 'Detalhes', 'Ficha'];

export default function App() {
  const [ready, setReady] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [gmMode, setGmMode] = useState(false);
  const [gmGate, setGmGate] = useState(false);
  const [char, setChar] = useState(emptyChar());
  const [step, setStep] = useState(0);
  const [maxStepReached, setMaxStepReached] = useState(0);
  const saveTimer = useRef(null);

  useEffect(() => { setReady(true); }, []);

  useEffect(() => {
    if (!playerName) return;
    (async () => {
      const saved = await loadCharacter(slugify(playerName));
      if (saved) {
        const { jogador, _atualizado, _step, _maxStep, ...rest } = saved;
        setChar(prev => ({ ...prev, ...rest }));
        if (typeof saved._step === 'number') setStep(saved._step);
        if (typeof saved._maxStep === 'number') setMaxStepReached(saved._maxStep);
      }
    })();
  }, [playerName]);

  useEffect(() => {
    if (!playerName) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveCharacter(slugify(playerName), playerName, { ...char, _step: step, _maxStep: Math.max(maxStepReached, step) });
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [char, step, playerName, maxStepReached]);

  // aceita um objeto (patch estático) ou uma função (prev => patch) — a função sempre vê o estado mais recente,
  // mesmo quando duas atualizações acontecem antes do React re-renderizar entre um clique e outro.
  const update = useCallback((patch) => {
    setChar(prev => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  }, []);

  // salva imediatamente nos momentos-chave (troca de etapa), além do salvamento contínuo com debounce acima —
  // assim, se a pessoa fechar a aba logo após avançar de etapa, o progresso não se perde esperando o debounce.
  function goStep(n) {
    setStep(n);
    setMaxStepReached(m => {
      const next = Math.max(m, n);
      if (playerName) {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveCharacter(slugify(playerName), playerName, { ...char, _step: n, _maxStep: next });
      }
      return next;
    });
  }

  if (!ready) return null;

  if (!playerName && !gmMode) {
    return (
      <div className="pj-root">
        <GlobalStyle />
        <div className="pj-shell pj-gate">
          <div className="pj-title" style={{ marginBottom: 4 }}>Criador de Personagens</div>
          <div className="pj-sub" style={{ marginBottom: 22 }}>D&amp;D 5ª Edição (2024) — Livro do Jogador</div>
          <Panel>
            <Eyebrow>Para começar</Eyebrow>
            <div className="pj-step-title" style={{ fontSize: 18 }}>Qual seu nome ou apelido na mesa?</div>
            <div className="pj-step-desc">Isso salva seu progresso — você pode fechar e voltar quando quiser.</div>
            <input className="pj-input" value={nameInput} onChange={e => setNameInput(e.target.value)}
              placeholder="ex: Marina" onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) setPlayerName(nameInput.trim()); }} />
            <div className="pj-nav">
              <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={() => setGmGate(true)}>Sou o Mestre</button>
              <button className="pj-btn pj-btn-primary" disabled={!nameInput.trim()} onClick={() => setPlayerName(nameInput.trim())}>Começar →</button>
            </div>
            {gmGate && <GmLoginInline onEnter={() => { setGmMode(true); setGmGate(false); }} onCancel={() => setGmGate(false)} />}
          </Panel>
        </div>
      </div>
    );
  }

  if (gmMode) {
    return (
      <div className="pj-root">
        <GlobalStyle />
        <div className="pj-shell">
          <GMPanel onExit={() => setGmMode(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="pj-root">
      <GlobalStyle />
      <div className="pj-shell">
        <div className="pj-header">
          <div>
            <div className="pj-title">Criador de Personagens</div>
            <div className="pj-sub">Jogador(a): {playerName} · progresso salvo automaticamente</div>
          </div>
          <button className="pj-btn pj-btn-ghost pj-btn-small" onClick={() => setPlayerName('')}>Trocar de jogador</button>
        </div>

        <div className="pj-tabs">
          {STEP_LABELS.map((label, i) => (
            <button key={label} className={'pj-tab' + (i === step ? ' is-active' : '') + (i < step ? ' is-done' : '')}
              disabled={i > maxStepReached} onClick={() => goStep(i)}>
              {i < step ? '✓ ' : ''}{i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 && <StepClasse char={char} update={update} onNext={() => goStep(1)} />}
        {step === 1 && <StepOrigem char={char} update={update} onNext={() => goStep(2)} onBack={() => goStep(0)} />}
        {step === 2 && <StepAtributos char={char} update={update} onNext={() => goStep(3)} onBack={() => goStep(1)} />}
        {step === 3 && <StepAlinhamento char={char} update={update} onNext={() => goStep(4)} onBack={() => goStep(2)} />}
        {step === 4 && <StepDetalhes char={char} update={update} onNext={() => goStep(5)} onBack={() => goStep(3)} />}
        {step === 5 && <Ficha char={char} playerName={playerName} onBack={() => goStep(4)} />}
      </div>
    </div>
  );
}