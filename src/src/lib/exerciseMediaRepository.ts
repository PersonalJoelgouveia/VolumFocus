import { deleteObject, getDownloadURL, ref, storage, uploadBytes } from './firebase';

/**
 * Camada repository de mídia de exercício — sucessora de
 * mxCompressAndStore()/mxUploadMediaToDrive() (index.html ~5237-5294).
 *
 * Diferença deliberada do original: lá, `mxUploadMediaToDrive()` era
 * explicitamente um MOCK (comentário no próprio código: "NÃO faz parte
 * da persistência de dados migrada... Estrutura pronta para,
 * futuramente, plugar upload real"). Aqui é esse "futuramente" —
 * uploadBytes/getDownloadURL reais do Firebase Storage, nunca Base64.
 *
 * Caminho determinístico `exercicios/{exerciseId}/{key}.jpg`: reenviar
 * pra a mesma chave (substituir a imagem) sobrescreve o arquivo no lugar,
 * sem sobrar lixo órfão no Storage.
 *
 * IMPORTANTE — requer regra no Firebase Storage (Storage Rules, não
 * Firestore Rules — arquivo separado):
 *   match /exercicios/{exerciseId}/{fileName} {
 *     allow read: if true; // thumbnails/imagens de exercício são públicas no app
 *     allow write: if request.auth != null
 *       && request.resource.size < 5 * 1024 * 1024
 *       && request.resource.contentType.matches('image/.*');
 *   }
 */

const MAX_DIM = 1400;
const JPEG_QUALITY = 0.75;

export type ImageSlotKey = 'inicio' | 'fim';

/** Redimensiona (máx. 1400px) e recomprime pra JPEG via Canvas — migrado de mxCompressAndStore(). */
export function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas indisponível'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem'))),
          'image/jpeg',
          JPEG_QUALITY
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Comprime e envia pro Firebase Storage — retorna a URL pública persistente. */
export async function uploadExerciseImage(exerciseId: string, key: ImageSlotKey, file: File): Promise<string> {
  const blob = await compressImage(file);
  const storageRef = ref(storage, `exercicios/${exerciseId}/${key}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  return getDownloadURL(storageRef);
}

/** Remove a imagem do Storage — best-effort (silencioso se já não existir). */
export async function deleteExerciseImage(exerciseId: string, key: ImageSlotKey): Promise<void> {
  try {
    await deleteObject(ref(storage, `exercicios/${exerciseId}/${key}.jpg`));
  } catch (e) {
    // Arquivo já removido ou nunca existiu — não é um erro que o usuário precise ver.
    console.warn('deleteExerciseImage: falha ao remover (ignorado)', e);
  }
}
