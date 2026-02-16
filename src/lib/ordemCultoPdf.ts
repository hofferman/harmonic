import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type {
  OrdemCulto,
  OrdemCultoBloco,
  BlocoConteudo,
  BlocoTipo,
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

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const USABLE_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const USABLE_HEIGHT = PAGE_HEIGHT - 2 * MARGIN;

interface SizeConfig {
  churchNameSize: number;
  dateSize: number;
  titleSize: number;
  headerSize: number;
  bodySize: number;
  lineHeight: number;
  sectionGap: number;
  headerGap: number;
}

const DEFAULT_SIZE: SizeConfig = {
  churchNameSize: 16,
  dateSize: 11,
  titleSize: 13,
  headerSize: 12,
  bodySize: 10,
  lineHeight: 5,
  sectionGap: 7,
  headerGap: 3,
};

const COMPACT_SIZE: SizeConfig = {
  churchNameSize: 14,
  dateSize: 10,
  titleSize: 12,
  headerSize: 11,
  bodySize: 9,
  lineHeight: 4.2,
  sectionGap: 5,
  headerGap: 2,
};

const ULTRA_COMPACT_SIZE: SizeConfig = {
  churchNameSize: 13,
  dateSize: 9,
  titleSize: 11,
  headerSize: 10,
  bodySize: 8.5,
  lineHeight: 3.8,
  sectionGap: 4,
  headerGap: 1.5,
};

function calculateContentHeight(
  blocos: OrdemCultoBloco[],
  contents: Record<string, BlocoConteudo>,
  escalaData: EscalaData | undefined,
  size: SizeConfig,
): number {
  // Header area: church name + date + title + separator
  let height = size.lineHeight * 2 + size.lineHeight + size.lineHeight + size.sectionGap + 2;

  for (const bloco of blocos) {
    // Section header
    height += size.lineHeight + size.headerGap;

    const content = contents[bloco.id] || {};

    switch (bloco.tipo) {
      case 'abertura':
        height += size.lineHeight;
        break;
      case 'louvor': {
        const lc = content as LouvorConteudo;
        const selectedIds = lc.musica_ids || [];
        if (escalaData) {
          if (escalaData.membros.length > 0) {
            const membrosText = escalaData.membros
              .map(m => `${m.profile.nome} (${m.funcao_na_escala})`)
              .join(', ');
            const wrappedLines = Math.ceil(membrosText.length / 70);
            height += size.lineHeight * wrappedLines;
          }
          const filteredMusicas = selectedIds.length > 0
            ? escalaData.musicas.filter(m => selectedIds.includes(m.musica.id))
            : escalaData.musicas;
          if (filteredMusicas.length > 0) {
            height += size.lineHeight;
            height += filteredMusicas.length * size.lineHeight;
          }
        }
        break;
      }
      case 'oracao_oferta':
        height += size.lineHeight;
        break;
      case 'avisos': {
        const c = content as AvisosConteudo;
        const text = c.texto || '';
        const lines = text.split('\n').length;
        const wrappedLines = Math.max(lines, Math.ceil(text.length / 70));
        height += size.lineHeight * Math.max(wrappedLines, 1);
        break;
      }
      case 'pregacao':
        height += size.lineHeight * 3;
        break;
      case 'encerramento':
        height += size.lineHeight;
        break;
      case 'especial': {
        const ec = content as EspecialConteudo;
        height += size.lineHeight; // titulo
        if (ec.descricao) {
          const descLines = Math.max(ec.descricao.split('\n').length, Math.ceil(ec.descricao.length / 70));
          height += size.lineHeight * descLines;
        }
        break;
      }
    }

    height += size.sectionGap;
  }

  return height;
}

export function gerarOrdemCultoPdf(
  ordemCulto: OrdemCulto,
  blocos: OrdemCultoBloco[],
  blocoContents: Record<string, BlocoConteudo>,
  escalaData?: EscalaData,
): void {
  const doc = new jsPDF('p', 'mm', 'a4');

  // Determine best size config
  let size = DEFAULT_SIZE;
  let contentHeight = calculateContentHeight(blocos, blocoContents, escalaData, size);

  if (contentHeight > USABLE_HEIGHT) {
    size = COMPACT_SIZE;
    contentHeight = calculateContentHeight(blocos, blocoContents, escalaData, size);
  }
  if (contentHeight > USABLE_HEIGHT) {
    size = ULTRA_COMPACT_SIZE;
  }

  let y = MARGIN;
  const centerX = PAGE_WIDTH / 2;

  // Church name
  doc.setFontSize(size.churchNameSize);
  doc.setFont('helvetica', 'bold');
  doc.text(NOME_IGREJA, centerX, y, { align: 'center' });
  y += size.lineHeight * 1.5;

  // Separator line
  doc.setDrawColor(180, 160, 100);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += size.sectionGap;

  // Date
  const dateStr = format(
    new Date(ordemCulto.data + 'T00:00:00'),
    "EEEE, d 'de' MMMM 'de' yyyy",
    { locale: ptBR }
  );
  doc.setFontSize(size.dateSize);
  doc.setFont('helvetica', 'normal');
  // Capitalize first letter
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  doc.text(capitalizedDate, centerX, y, { align: 'center' });
  y += size.lineHeight;

  // Title
  doc.setFontSize(size.titleSize);
  doc.setFont('helvetica', 'bold');
  doc.text(ordemCulto.titulo, centerX, y, { align: 'center' });
  y += size.lineHeight + size.sectionGap;

  // Second separator
  doc.setDrawColor(220, 200, 150);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 20, y, PAGE_WIDTH - MARGIN - 20, y);
  y += size.sectionGap;

  // Render blocks
  blocos.forEach((bloco, index) => {
    const content = blocoContents[bloco.id] || {};

    // Section header
    doc.setFontSize(size.headerSize);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(120, 100, 40);
    doc.text(`${index + 1}. ${BLOCO_TIPO_LABELS[bloco.tipo].toUpperCase()}`, MARGIN, y);
    doc.setTextColor(0, 0, 0);
    y += size.headerGap;

    // Thin line under header
    doc.setDrawColor(230, 220, 190);
    doc.setLineWidth(0.15);
    doc.line(MARGIN, y, MARGIN + 60, y);
    y += size.headerGap;

    doc.setFontSize(size.bodySize);
    doc.setFont('helvetica', 'normal');

    switch (bloco.tipo) {
      case 'abertura': {
        const c = content as AberturaConteudo;
        if (c.dirigente) {
          doc.text(`Dirigente: ${c.dirigente}`, MARGIN + 4, y);
          y += size.lineHeight;
        }
        break;
      }

      case 'louvor': {
        const lc = content as LouvorConteudo;
        const selectedIds = lc.musica_ids || [];
        if (escalaData) {
          if (escalaData.membros.length > 0) {
            const membrosText = escalaData.membros
              .map(m => `${m.profile.nome} (${m.funcao_na_escala})`)
              .join(', ');

            doc.setFont('helvetica', 'bold');
            doc.text('Equipe: ', MARGIN + 4, y);
            const equipeLabelWidth = doc.getTextWidth('Equipe: ');
            doc.setFont('helvetica', 'normal');

            const lines = doc.splitTextToSize(membrosText, USABLE_WIDTH - 4 - equipeLabelWidth);
            if (lines.length > 0) {
              doc.text(lines[0], MARGIN + 4 + equipeLabelWidth, y);
              y += size.lineHeight;
              for (let i = 1; i < lines.length; i++) {
                doc.text(lines[i], MARGIN + 4 + equipeLabelWidth, y);
                y += size.lineHeight;
              }
            }
          }

          // Show only selected songs, or all if none selected
          const filteredMusicas = selectedIds.length > 0
            ? escalaData.musicas.filter(m => selectedIds.includes(m.musica.id))
            : escalaData.musicas;

          if (filteredMusicas.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.text('Músicas:', MARGIN + 4, y);
            doc.setFont('helvetica', 'normal');
            y += size.lineHeight;

            filteredMusicas.forEach((item, idx) => {
              let line = `  ${idx + 1}. ${item.musica.titulo}`;
              if (item.musica.artista) line += ` - ${item.musica.artista}`;
              if (item.musica.tom) line += ` (Tom: ${item.musica.tom})`;
              doc.text(line, MARGIN + 4, y);
              y += size.lineHeight;
            });
          }
        }
        break;
      }

      case 'oracao_oferta': {
        const c = content as OracaoOfertaConteudo;
        if (c.pessoa) {
          doc.text(`Pessoa: ${c.pessoa}`, MARGIN + 4, y);
          y += size.lineHeight;
        }
        break;
      }

      case 'avisos': {
        const c = content as AvisosConteudo;
        if (c.texto) {
          const lines = doc.splitTextToSize(c.texto, USABLE_WIDTH - 4);
          for (const line of lines) {
            doc.text(line, MARGIN + 4, y);
            y += size.lineHeight;
          }
        }
        break;
      }

      case 'pregacao': {
        const c = content as PregacaoConteudo;
        if (c.pregador) {
          doc.setFont('helvetica', 'bold');
          doc.text('Pregador: ', MARGIN + 4, y);
          const w = doc.getTextWidth('Pregador: ');
          doc.setFont('helvetica', 'normal');
          doc.text(c.pregador, MARGIN + 4 + w, y);
          y += size.lineHeight;
        }
        if (c.tema) {
          doc.setFont('helvetica', 'bold');
          doc.text('Tema: ', MARGIN + 4, y);
          const w = doc.getTextWidth('Tema: ');
          doc.setFont('helvetica', 'normal');
          doc.text(c.tema, MARGIN + 4 + w, y);
          y += size.lineHeight;
        }
        if (c.versiculo) {
          doc.setFont('helvetica', 'bold');
          doc.text('Texto: ', MARGIN + 4, y);
          const w = doc.getTextWidth('Texto: ');
          doc.setFont('helvetica', 'normal');
          doc.text(c.versiculo, MARGIN + 4 + w, y);
          y += size.lineHeight;
        }
        break;
      }

      case 'encerramento': {
        const c = content as EncerramentoConteudo;
        if (c.pessoa) {
          doc.text(`Responsável: ${c.pessoa}`, MARGIN + 4, y);
          y += size.lineHeight;
        }
        break;
      }

      case 'especial': {
        const c = content as EspecialConteudo;
        if (c.titulo) {
          doc.setFont('helvetica', 'bold');
          doc.text(c.titulo, MARGIN + 4, y);
          doc.setFont('helvetica', 'normal');
          y += size.lineHeight;
        }
        if (c.descricao) {
          const lines = doc.splitTextToSize(c.descricao, USABLE_WIDTH - 4);
          for (const line of lines) {
            doc.text(line, MARGIN + 4, y);
            y += size.lineHeight;
          }
        }
        break;
      }
    }

    y += size.sectionGap;
  });

  // Save
  const fileName = `ordem-culto-${ordemCulto.data}.pdf`;
  doc.save(fileName);
}
