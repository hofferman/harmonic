export type BlocoTipo = 'abertura' | 'louvor' | 'oracao_oferta' | 'avisos' | 'pregacao' | 'encerramento' | 'especial';

export interface AberturaConteudo {
  dirigente: string;
}

export interface LouvorConteudo {
  musica_ids?: string[];
}

export interface OracaoOfertaConteudo {
  pessoa: string;
}

export interface AvisosConteudo {
  texto: string;
}

export interface PregacaoConteudo {
  pregador: string;
  tema: string;
  versiculo: string;
}

export interface EncerramentoConteudo {
  pessoa: string;
}

export interface EspecialConteudo {
  titulo: string;
  descricao: string;
}

export type BlocoConteudo =
  | AberturaConteudo
  | LouvorConteudo
  | OracaoOfertaConteudo
  | AvisosConteudo
  | PregacaoConteudo
  | EncerramentoConteudo
  | EspecialConteudo;

export interface OrdemCulto {
  id: string;
  data: string;
  titulo: string;
  status: 'rascunho' | 'publicada';
  escala_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrdemCultoBloco {
  id: string;
  ordem_culto_id: string;
  tipo: BlocoTipo;
  ordem: number;
  conteudo: BlocoConteudo;
  created_at: string;
}

export const BLOCO_TIPO_LABELS: Record<BlocoTipo, string> = {
  abertura: 'Abertura',
  louvor: 'Louvor',
  oracao_oferta: 'Oração da Oferta',
  avisos: 'Avisos',
  pregacao: 'Pregação',
  encerramento: 'Encerramento',
  especial: 'Especial',
};

export const BLOCO_TIPOS_ORDEM: BlocoTipo[] = [
  'abertura',
  'louvor',
  'oracao_oferta',
  'avisos',
  'pregacao',
  'encerramento',
  'especial',
];

export const NOME_IGREJA = 'Igreja Abrace';
