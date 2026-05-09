import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  OrdemCulto,
  OrdemCultoBloco,
  BlocoConteudo,
  AberturaConteudo,
  LouvorConteudo,
  OracaoOfertaConteudo,
  AvisosConteudo,
  PregacaoConteudo,
  EncerramentoConteudo,
  EspecialConteudo,
} from '@/types/ordemCulto';
import { BLOCO_TIPO_LABELS, NOME_IGREJA } from '@/types/ordemCulto';

interface EscalaMembro {
  id: string;
  funcao_na_escala: string;
  profile: { id: string; nome: string };
}

interface EscalaMusica {
  id: string;
  ordem: number;
  musica: {
    id: string;
    titulo: string;
    artista: string | null;
    tom: string | null;
  };
  ministro: { id: string; nome: string } | null;
}

interface EscalaData {
  membros: EscalaMembro[];
  musicas: EscalaMusica[];
}

const compactBlankLines = (lines: string[]) =>
  lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const appendIfPresent = (lines: string[], label: string, value?: string | null) => {
  const trimmed = value?.trim();
  if (trimmed) {
    lines.push(`${label}: ${trimmed}`);
  }
};

export function gerarOrdemCultoMensagem(
  ordemCulto: OrdemCulto,
  blocos: OrdemCultoBloco[],
  blocoContents: Record<string, BlocoConteudo>,
  escalaData?: EscalaData,
): string {
  const dateStr = format(
    new Date(ordemCulto.data + 'T00:00:00'),
    "EEEE, d 'de' MMMM 'de' yyyy",
    { locale: ptBR },
  );
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

  const lines: string[] = [
    `*${NOME_IGREJA}*`,
    `*${ordemCulto.titulo}*`,
    capitalizedDate,
    '',
    '*Ordem de Culto*',
    '',
  ];

  blocos.forEach((bloco, index) => {
    const content = blocoContents[bloco.id] || {};
    lines.push(`*${index + 1}. ${BLOCO_TIPO_LABELS[bloco.tipo]}*`);

    switch (bloco.tipo) {
      case 'abertura': {
        const c = content as AberturaConteudo;
        appendIfPresent(lines, 'Dirigente', c.dirigente);
        break;
      }

      case 'louvor': {
        const c = content as LouvorConteudo;
        const selectedIds = c.musica_ids || [];

        if (escalaData?.membros.length) {
          lines.push('Equipe:');
          escalaData.membros.forEach(membro => {
            lines.push(`- ${membro.profile.nome} (${membro.funcao_na_escala})`);
          });
        }

        if (escalaData?.musicas.length) {
          const musicas = selectedIds.length > 0
            ? escalaData.musicas.filter(item => selectedIds.includes(item.musica.id))
            : escalaData.musicas;

          if (musicas.length) {
            lines.push('Músicas:');
            musicas.forEach((item, musicaIndex) => {
              const detalhes = [
                item.musica.artista,
                item.musica.tom ? `Tom: ${item.musica.tom}` : null,
                item.ministro ? `Ministro: ${item.ministro.nome}` : null,
              ].filter(Boolean);
              const suffix = detalhes.length ? ` (${detalhes.join(' - ')})` : '';
              lines.push(`${musicaIndex + 1}. ${item.musica.titulo}${suffix}`);
            });
          }
        }
        break;
      }

      case 'oracao_oferta': {
        const c = content as OracaoOfertaConteudo;
        appendIfPresent(lines, 'Responsavel', c.pessoa);
        break;
      }

      case 'avisos': {
        const c = content as AvisosConteudo;
        appendIfPresent(lines, 'Avisos', c.texto);
        break;
      }

      case 'pregacao': {
        const c = content as PregacaoConteudo;
        appendIfPresent(lines, 'Pregador', c.pregador);
        appendIfPresent(lines, 'Tema', c.tema);
        appendIfPresent(lines, 'Texto', c.versiculo);
        break;
      }

      case 'encerramento': {
        const c = content as EncerramentoConteudo;
        appendIfPresent(lines, 'Responsavel', c.pessoa);
        break;
      }

      case 'especial': {
        const c = content as EspecialConteudo;
        appendIfPresent(lines, 'Titulo', c.titulo);
        appendIfPresent(lines, 'Descricao', c.descricao);
        break;
      }
    }

    lines.push('');
  });

  return compactBlankLines(lines);
}
