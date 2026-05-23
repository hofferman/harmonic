export interface EscalaSetorRef {
  nome: string;
}

export interface EscalaMembroRoleRef {
  funcao_na_escala: string;
  setor?: EscalaSetorRef | null;
}

export const formatEscalaMembroRole = (membro: EscalaMembroRoleRef) => {
  const funcao = membro.funcao_na_escala?.trim();
  const setor = membro.setor?.nome?.trim();

  if (setor && funcao && funcao.toLowerCase() !== setor.toLowerCase()) {
    return `${setor} - ${funcao}`;
  }

  return funcao || setor || '';
};
