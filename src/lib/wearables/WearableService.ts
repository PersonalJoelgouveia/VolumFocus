/**
 * Orquestra qual WearableProvider está ativo E a sincronização incremental
 * com dedup/idempotência/fila offline (Etapa 6) por cima dele. Os
 * providers nativos (Health Connect / HealthKit) continuam só leitura
 * pontual — toda a lógica de "o que já foi baixado", "o que falta" e "o
 * que falhou e precisa retentar" mora aqui, não neles. Isso mantém
 * HealthConnectProvider/HealthKitProvider inalterados e testáveis
 * isoladamente, e faz o motor de sync funcionar igual pras duas
 * plataformas de graça.
 */

import type { DateRange, PlatformId, ScopeSyncOutcome, SyncResult, WearableScope, WearableSyncRecord } from './models';
import type { WearableProvider } from './WearableProvider';
import { WebFallbackProvider } from './WebFallbackProvider';
import { HealthConnectProvider } from './HealthConnectProvider';
import { HealthKitProvider } from './HealthKitProvider';
import { detectPlatform } from './platform';
import { hashRecordId } from './recordId';
import * as LocalStore from './WearableLocalStore';

/** Todos os escopos que a sincronização automática cobre. `sessions` fica
 *  de fora do loop genérico (formato próprio, sem "valor" único) e ganha
 *  tratamento dedicado dentro de syncScope. */
const SYNCABLE_SCOPES: WearableScope[] = ['heartRate', 'restingHeartRate', 'steps', 'distance', 'calories', 'sessions'];

/** Sem cursor prévio (primeiro sync do escopo), a janela inicial é
 *  limitada — evita puxar anos de histórico de uma vez e travar o
 *  aparelho. Syncs seguintes são sempre incrementais a partir do último
 *  sucesso. */
const INITIAL_WINDOW_DAYS = 30;
const MAX_RETRY_ATTEMPTS = 5;

function isOnline(): boolean {
  try {
    return typeof navigator === 'undefined' || navigator.onLine !== false;
  } catch {
    return true;
  }
}

/** Extrai o timestamp "natural" de cada item bruto retornado pelo
 *  provider, por escopo — é esse valor que entra no hash determinístico
 *  do id (junto com provider+type) e na indexação por range no store
 *  local. */
function timestampOf(scope: WearableScope, item: unknown): string {
  if (scope === 'sessions') {
    return (item as { start: Date }).start.toISOString();
  }
  if (scope === 'heartRate' || scope === 'restingHeartRate') {
    return (item as { timestamp: string }).timestamp;
  }
  return (item as { date: string }).date;
}

async function fetchScope(provider: WearableProvider, scope: WearableScope, range: DateRange): Promise<unknown[]> {
  switch (scope) {
    case 'heartRate':
      return provider.getHeartRate(range);
    case 'restingHeartRate':
      return provider.getRestingHeartRate(range);
    case 'steps':
      return provider.getSteps(range);
    case 'distance':
      return provider.getDistance(range);
    case 'calories':
      return provider.getCalories(range);
    case 'sessions':
      return provider.getSessions(range);
  }
}

export class WearableService {
  private providers = new Map<PlatformId, WearableProvider>();
  private readonly platform: PlatformId;

  constructor(platform: PlatformId) {
    this.platform = platform;
    // Fallback padrão pras 3 plataformas — providers nativos reais
    // substituem essas entradas em etapa futura via registerProvider().
    this.providers.set('web', new WebFallbackProvider('web'));
    this.providers.set('android', new WebFallbackProvider('android'));
    this.providers.set('ios', new WebFallbackProvider('ios'));
  }

  /** Substitui o provider de uma plataforma específica (usado pelos
   *  providers nativos reais, numa etapa futura, e por testes). */
  registerProvider(platform: PlatformId, provider: WearableProvider): void {
    this.providers.set(platform, provider);
  }

  getProvider(): WearableProvider {
    return this.providers.get(this.platform) ?? new WebFallbackProvider(this.platform);
  }

  getPlatform(): PlatformId {
    return this.platform;
  }

  /**
   * Sincronização incremental + dedup + idempotência + fila offline.
   * Sempre resolve (nunca lança) — falha de rede/permissão em um escopo
   * não derruba os demais nem trava o app; cada escopo tem seu próprio
   * cursor e seu próprio resultado.
   *
   * Idempotência: rodar sync() várias vezes seguidas, sem novo dado
   * disponível, produz o mesmo estado local (mesmos ids, mesmos
   * payloads) — o cursor incremental faz o segundo run buscar uma janela
   * vazia, e mesmo que buscasse a mesma janela de novo, o id
   * determinístico faria o put() ser um no-op de conteúdo.
   */
  async sync(scopes: WearableScope[] = SYNCABLE_SCOPES): Promise<SyncResult> {
    const startedAt = new Date().toISOString();

    if (!isOnline()) {
      return {
        status: 'offline',
        outcomes: scopes.map((scope) => ({ scope, status: 'skipped-offline', recordsWritten: 0 })),
        startedAt,
        finishedAt: new Date().toISOString(),
        pendingRetryCount: (await LocalStore.listRetryQueue()).length,
      };
    }

    const provider = this.getProvider();

    // WebFallbackProvider (Web, ou Android/iOS antes do provider nativo
    // registrar) não é uma FALHA de sync — é a ausência esperada de
    // wearable nesta plataforma. Não enfileira retry, não mexe em
    // cursor nenhum, e não conta como erro no status agregado.
    if (provider instanceof WebFallbackProvider) {
      return {
        status: 'ok',
        outcomes: scopes.map((scope) => ({ scope, status: 'skipped-unsupported', recordsWritten: 0 })),
        startedAt,
        finishedAt: new Date().toISOString(),
        pendingRetryCount: (await LocalStore.listRetryQueue()).length,
      };
    }

    const outcomes: ScopeSyncOutcome[] = [];

    for (const scope of scopes) {
      outcomes.push(await this.syncScope(provider, scope));
      // Cede a thread principal entre escopos — sync de vários escopos em
      // sequência não deve segurar a UI, mesmo em aparelhos mais fracos.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const finishedAt = new Date().toISOString();
    const hasError = outcomes.some((o) => o.status === 'error');
    const hasOk = outcomes.some((o) => o.status === 'ok');
    const status: SyncResult['status'] = hasError ? (hasOk ? 'partial' : 'error') : 'ok';

    return { status, outcomes, startedAt, finishedAt, pendingRetryCount: (await LocalStore.listRetryQueue()).length };
  }

  /** Retenta escopos que ficaram na fila (offline anterior, erro
   *  transitório etc.). Entradas que já bateram o teto de tentativas são
   *  descartadas silenciosamente — evita fila crescendo pra sempre por um
   *  escopo permanentemente indisponível (ex: permissão revogada de
   *  vez). */
  async processRetryQueue(): Promise<void> {
    if (!isOnline()) return;
    const queue = await LocalStore.listRetryQueue();
    const provider = this.getProvider();
    for (const entry of queue) {
      if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
        await LocalStore.dequeueRetry(entry.id);
        continue;
      }
      const outcome = await this.syncScope(provider, entry.scope);
      if (outcome.status === 'ok') {
        await LocalStore.dequeueRetry(entry.id);
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /** Histórico já sincronizado, direto do armazenamento local — não bate
   *  na API nativa de novo. Usado pelas telas pra exibir dado agregado
   *  sem repetir custo de I/O nativo a cada render. */
  async getLocalHistory(scope: WearableScope, range: DateRange) {
    return LocalStore.getRecordsInRange(scope, range);
  }

  async getPendingRetryCount(): Promise<number> {
    return (await LocalStore.listRetryQueue()).length;
  }

  private async syncScope(provider: WearableProvider, scope: WearableScope): Promise<ScopeSyncOutcome> {
    const cursor = await LocalStore.getCursor(scope);
    const now = new Date();
    const start = cursor.lastSuccessfulSyncAt
      ? new Date(cursor.lastSuccessfulSyncAt)
      : new Date(now.getTime() - INITIAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const range: DateRange = { start, end: now };

    try {
      // Os providers reais (HealthConnect/HealthKit) nunca lançam nos
      // métodos de leitura — erro interno vira log + retorno vazio (ver
      // Etapas 3/4). Isso significa que "sem dado novo" e "leitura falhou"
      // são indistinguíveis no valor de retorno; o único sinal confiável
      // de indisponibilidade real (device sem suporte, plugin não
      // inicializado, permissão nunca concedida) é isAvailable(). É nesse
      // sinal que o sync usa pra decidir entre "ok com zero registros" e
      // "erro, enfileira retry".
      if (!(await provider.isAvailable())) {
        throw new Error(`provider "${provider.id}" indisponível para o escopo "${scope}"`);
      }
      const rawItems = await fetchScope(provider, scope, range);
      const records: WearableSyncRecord[] = rawItems.map((item) => {
        const timestamp = timestampOf(scope, item);
        return {
          id: hashRecordId(provider.id, scope, timestamp),
          provider: provider.id,
          type: scope,
          timestamp,
          syncedAt: now.toISOString(),
          payload: item,
        };
      });
      const recordsWritten = await LocalStore.putRecords(records);

      await LocalStore.setCursor(scope, { lastSyncAt: now.toISOString(), lastSuccessfulSyncAt: now.toISOString() });
      return { scope, status: 'ok', recordsWritten };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`WearableService: sync do escopo "${scope}" falhou, mantendo cursor anterior`, e);
      await LocalStore.setCursor(scope, { lastSyncAt: now.toISOString(), lastSuccessfulSyncAt: cursor.lastSuccessfulSyncAt });
      const existing = (await LocalStore.listRetryQueue()).find((entry) => entry.scope === scope);
      await LocalStore.enqueueRetry({
        id: existing?.id ?? `retry-${scope}-${now.getTime()}`,
        scope,
        range: { start: range.start.toISOString(), end: range.end.toISOString() },
        attempts: (existing?.attempts ?? 0) + 1,
        lastError: message,
        enqueuedAt: now.toISOString(),
      });
      return { scope, status: 'error', recordsWritten: 0, error: message };
    }
  }
}

let singleton: WearableService | null = null;

/** Acesso padrão do resto do app — plataforma detectada uma vez, cacheada
 *  pela sessão do app. */
export function getWearableService(): WearableService {
  if (!singleton) {
    const platform = detectPlatform();
    singleton = new WearableService(platform);
    if (platform === 'android') {
      // Único ponto de wiring do provider real desta etapa — Web e iOS
      // seguem 100% no WebFallbackProvider, sem nenhuma mudança de
      // comportamento.
      singleton.registerProvider('android', new HealthConnectProvider());
    }
    if (platform === 'ios') {
      singleton.registerProvider('ios', new HealthKitProvider());
    }
  }
  return singleton;
}

/** Só pra testes — força a recriação do singleton entre casos. */
export function resetWearableService(): void {
  singleton = null;
}
