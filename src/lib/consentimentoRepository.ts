import { auth, db, doc, getDoc, setDoc, collection, query, where, limit, getDocs, writeBatch, serverTimestamp } from './firebase';
import { getMyOwnerUUID } from './ownerRepository';
import type { Aluno } from '../types/aluno';
import type { PhysicalAssessment } from '../types/assessment';
import {
  FINALIDADES,
  TEXTOS_CONSENTIMENTO,
  aindaMenorPorMaioridade,
  consentimentoObrigatorioOk,
  sha256Hex,
  textoParaHash,
  montarEvento,
  idAceiteAvaliacao,
  TEXTO_AVALIACAO_ONLINE,
  type EventoBase,
  type Decisao,
  type EstadoConsentimento,
  type Finalidade,
} from './consentimento';

/**
 * Persistência do consentimento do responsável. QUEM PODE O QUÊ é decidido pelas Security Rules
 * (firestore.etapaC.rules): este arquivo só monta os pedidos. O frontend não "aprova" nada: se as
 * Rules negarem, a autorização não existe.
 *
 *  - responsaveis/{alunoEmail}                  vínculo menor ↔ responsável (gravado pelo Personal dono)
 *  - consentimentos/{alunoEmail}/eventos/{id}   trilha IMUTÁVEL (create-only, hora do servidor)
 *  - consentimentos/{alunoEmail}/estado/{fin}   decisão vigente por finalidade (só o responsável)
 */

export interface VinculoResponsavel {
  alunoEmail: string;
  alunoNome: string;
  responsavelEmail: string;
  responsavelNome: string;
  parentesco: string;
  personalEmail: string;
  ownerUUID: string;
}

export type EstadosPorFinalidade = Partial<Record<Finalidade, EstadoConsentimento | null>>;

function vinculoDe(data: Record<string, unknown>): VinculoResponsavel {
  return {
    alunoEmail: String(data.alunoEmail ?? ''),
    alunoNome: String(data.alunoNome ?? ''),
    responsavelEmail: String(data.responsavelEmail ?? ''),
    responsavelNome: String(data.responsavelNome ?? ''),
    parentesco: String(data.parentesco ?? ''),
    personalEmail: String(data.personalEmail ?? ''),
    ownerUUID: String(data.ownerUUID ?? ''),
  };
}

/** Menores vinculados ao e-mail (Google verificado) do responsável logado. */
export async function buscarVinculosDoResponsavel(emailResponsavel: string): Promise<VinculoResponsavel[]> {
  const q = query(collection(db, 'responsaveis'), where('responsavelEmail', '==', emailResponsavel.toLowerCase()), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map((d) => vinculoDe(d.data()));
}

export async function buscarVinculoDoMenor(alunoEmail: string): Promise<VinculoResponsavel | null> {
  const snap = await getDoc(doc(db, 'responsaveis', alunoEmail.toLowerCase()));
  return snap.exists() ? vinculoDe(snap.data()) : null;
}

export async function buscarEstados(alunoEmail: string): Promise<EstadosPorFinalidade> {
  const a = alunoEmail.toLowerCase();
  const out: EstadosPorFinalidade = {};
  await Promise.all(
    FINALIDADES.map(async (f) => {
      const snap = await getDoc(doc(db, 'consentimentos', a, 'estado', f));
      out[f] = snap.exists() ? (snap.data() as EstadoConsentimento) : null;
    })
  );
  return out;
}

export interface SituacaoDoMenor {
  menor: boolean;
  vinculo: VinculoResponsavel | null;
  estados: EstadosPorFinalidade;
  /** Tratamento de dados + atendimento vigentes (versão atual do texto, mesmo responsável). */
  obrigatorioOk: boolean;
  /** Fotos/vídeos liberados (adulto: sempre; menor: só com uso_imagem vigente). */
  usoImagemOk: boolean;
}

/** Situação do próprio aluno logado. Falha de leitura => lança (o chamador trata como NÃO liberado). */
export async function avaliarSituacaoDoMenor(alunoEmail: string, maioridadeEm: unknown): Promise<SituacaoDoMenor> {
  if (!aindaMenorPorMaioridade(maioridadeEm)) {
    return { menor: false, vinculo: null, estados: {}, obrigatorioOk: true, usoImagemOk: true };
  }
  const [vinculo, estados] = await Promise.all([buscarVinculoDoMenor(alunoEmail), buscarEstados(alunoEmail)]);
  const resp = vinculo?.responsavelEmail ?? null;
  const usoImagem = estados.uso_imagem;
  return {
    menor: true,
    vinculo,
    estados,
    obrigatorioOk: consentimentoObrigatorioOk(estados, resp),
    usoImagemOk:
      !!usoImagem &&
      !!resp &&
      usoImagem.decisao === 'aceito' &&
      usoImagem.responsavelEmail === resp &&
      usoImagem.versaoTexto === TEXTOS_CONSENTIMENTO.uso_imagem.versao,
  };
}

/**
 * Evidência técnica de AUTORIA: uid, provedor de login e momento do login saem do ID token que o Firebase
 * Auth validou. O app só os repete no evento; as Security Rules RECUSAM o evento se divergirem do token
 * (request.auth). Não coleta IP, user-agent, documento ou CPF.
 */
async function evidenciaDoToken(): Promise<{ autorUid: string; provedor: string; authTime: number }> {
  const u = auth.currentUser;
  if (!u) throw new Error('Sem usuário autenticado');
  const r = await u.getIdTokenResult();
  const provedor = r.signInProvider;
  const authTime = Number(r.claims.auth_time);
  if (!provedor || !Number.isFinite(authTime)) throw new Error('Token sem evidência de autenticação');
  return { autorUid: u.uid, provedor, authTime };
}

/**
 * Registra a decisão do RESPONSÁVEL: evento imutável + estado vigente, no MESMO batch (as Rules exigem
 * que um aponte para o outro). Data/hora = serverTimestamp (== request.time nas Rules).
 * `substituiEventoId` liga uma correção ao evento que ela substitui (o antigo NUNCA é alterado).
 */
export async function registrarDecisao(
  vinculo: VinculoResponsavel,
  finalidade: Finalidade,
  decisao: Decisao,
  responsavelEmail: string,
  substituiEventoId?: string
): Promise<void> {
  const a = vinculo.alunoEmail.toLowerCase();
  const t = TEXTOS_CONSENTIMENTO[finalidade];
  const textoHash = await sha256Hex(textoParaHash(t));
  const ev = montarEvento({
    alunoEmail: a,
    ownerUUID: vinculo.ownerUUID,
    ...(await evidenciaDoToken()),
    autorPapel: 'responsavel',
    tipo: 'consentimento_responsavel',
    finalidade,
    decisao,
    versaoTexto: t.versao,
    textoHash,
    responsavelEmail,
    substituiEventoId,
  });
  const eventoRef = doc(collection(db, 'consentimentos', a, 'eventos'));
  const estadoRef = doc(db, 'consentimentos', a, 'estado', finalidade);
  const batch = writeBatch(db);
  batch.set(eventoRef, { ...ev, criadoEm: serverTimestamp() });
  batch.set(estadoRef, {
    finalidade,
    decisao,
    versaoTexto: t.versao,
    textoHash,
    responsavelEmail: ev.responsavelEmail,
    eventoId: eventoRef.id,
    atualizadoEm: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Aluno ADULTO envia a avaliação online: grava a avaliação E o evento de aceite no MESMO batch (as Rules
 * recusam a avaliação sem o evento). Menores não usam este caminho: valem a autorização do responsável.
 */
export async function criarAvaliacaoOnlineComAceite(studentEmail: string, assessment: PhysicalAssessment): Promise<string> {
  const a = studentEmail.toLowerCase();
  const alunoSnap = await getDoc(doc(db, 'alunos', a));
  const ownerUUID = alunoSnap.data()?.ownerUUID;
  if (typeof ownerUUID !== 'string') throw new Error('Cliente sem ownerUUID: não é possível registrar o aceite');
  const t = TEXTO_AVALIACAO_ONLINE;
  const ev: EventoBase = montarEvento({
    alunoEmail: a,
    ownerUUID,
    ...(await evidenciaDoToken()),
    autorPapel: 'aluno',
    tipo: 'aceite_avaliacao_online',
    finalidade: 'avaliacao_online',
    decisao: 'aceito',
    versaoTexto: t.versao,
    textoHash: await sha256Hex(textoParaHash(t)),
    avaliacaoId: assessment.id,
  });
  const batch = writeBatch(db);
  batch.set(doc(db, 'alunos', a, 'avaliacoesFisicas', assessment.id), JSON.parse(JSON.stringify(assessment)));
  batch.set(doc(db, 'consentimentos', a, 'eventos', idAceiteAvaliacao(assessment.id)), { ...ev, criadoEm: serverTimestamp() });
  await batch.commit();
  return assessment.id;
}

/** Exporta o histórico de eventos (para o responsável ou o Personal dono). Datas em ISO. */
export async function exportarEventos(alunoEmail: string): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(collection(db, 'consentimentos', alunoEmail.toLowerCase(), 'eventos'));
  return snap.docs
    .map((d) => {
      const x = d.data();
      const t = x.criadoEm as { toDate?: () => Date } | undefined;
      return { eventoId: d.id, ...x, criadoEm: t?.toDate ? t.toDate().toISOString() : null };
    })
    .sort((p, q) => String(p.criadoEm).localeCompare(String(q.criadoEm)));
}

/**
 * Personal dono: grava/atualiza o vínculo menor ↔ responsável. O e-mail do responsável NÃO vai para
 * `alunos/{email}` (que o outro Personal consegue ler) — fica só aqui.
 */
export async function syncResponsavelToCloud(aluno: Aluno, personalEmail: string): Promise<boolean> {
  const r = aluno.responsavel;
  if (!r?.email || !r.nome) return false;
  try {
    await setDoc(doc(db, 'responsaveis', aluno.email.toLowerCase()), {
      alunoEmail: aluno.email.toLowerCase(),
      alunoNome: aluno.nome,
      responsavelEmail: r.email.toLowerCase(),
      responsavelNome: r.nome,
      parentesco: r.parentesco ?? '',
      personalEmail: personalEmail.toLowerCase(),
      ownerUUID: await getMyOwnerUUID(),
      atualizadoEm: serverTimestamp(),
    });
    return true;
  } catch (e) {
    console.error('consentimentoRepository: falha ao gravar vínculo do responsável', e);
    return false;
  }
}
