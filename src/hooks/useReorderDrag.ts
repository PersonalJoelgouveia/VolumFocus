import { useRef, useState } from 'react';
import type { DragEvent, TouchEvent } from 'react';

/**
 * Migrado do módulo `ro-` (index.html ~9614-9801): drag & drop nativo no
 * desktop (dragstart/dragenter/dragover/drop/dragend) + touch drag no
 * mobile (ghost visual clonado, seguindo o dedo, com detecção de alvo
 * pelo centro do ghost). `onReorder(from, to)` é chamado uma única vez,
 * ao soltar — quem persiste é o chamador (RegistroView -> setDayLog).
 */
export function useReorderDrag(active: boolean, onReorder: (fromIdx: number, toIdx: number) => void) {
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const touchStartY = useRef(0);
  const touchIdx = useRef<number | null>(null);
  const touchGhostEl = useRef<HTMLElement | null>(null);
  const touchSourceEl = useRef<HTMLElement | null>(null);
  const touchOverIdx = useRef<number | null>(null);

  function handleDragStart(idx: number) {
    return (e: DragEvent<HTMLDivElement>) => {
      setDraggingIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(idx));
    };
  }

  function handleDragEnter(idx: number) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverIdx(idx);
    };
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(idx: number) {
    return (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (draggingIdx !== null && idx !== draggingIdx) onReorder(draggingIdx, idx);
    };
  }

  function handleDragEnd() {
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  function handleTouchStart(idx: number) {
    return (e: TouchEvent<HTMLDivElement>) => {
      if (!active) return;
      const touch = e.touches[0];
      const el = e.currentTarget;
      touchIdx.current = idx;
      touchSourceEl.current = el;
      touchStartY.current = touch.clientY;

      const rect = el.getBoundingClientRect();
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.style.cssText = `
        position:fixed; top:${rect.top}px; left:${rect.left}px;
        width:${rect.width}px; opacity:0.85; z-index:9999; pointer-events:none;
        border-radius:12px; box-shadow:0 12px 40px rgba(0,0,0,0.55);
        border:1px solid var(--teal-border); background:var(--bg-2);
        transform:scale(1.02); transition:none;
      `;
      document.body.appendChild(ghost);
      touchGhostEl.current = ghost;
      setDraggingIdx(idx);
      e.preventDefault();
    };
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (!touchGhostEl.current || !touchSourceEl.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy = touch.clientY - touchStartY.current;

    const rect = touchSourceEl.current.getBoundingClientRect();
    touchGhostEl.current.style.top = `${rect.top + dy}px`;

    const ghostCenterY = rect.top + dy + rect.height / 2;
    let newOverIdx: number | null = null;
    document.querySelectorAll<HTMLElement>('[data-reorder-idx]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (ghostCenterY >= r.top && ghostCenterY <= r.bottom) {
        newOverIdx = Number(el.dataset.reorderIdx);
      }
    });
    touchOverIdx.current = newOverIdx !== touchIdx.current ? newOverIdx : null;
    setDragOverIdx(touchOverIdx.current);
  }

  function handleTouchEnd() {
    if (touchGhostEl.current) {
      touchGhostEl.current.remove();
      touchGhostEl.current = null;
    }
    if (touchOverIdx.current !== null && touchIdx.current !== null && touchOverIdx.current !== touchIdx.current) {
      onReorder(touchIdx.current, touchOverIdx.current);
    }
    touchSourceEl.current = null;
    touchIdx.current = null;
    touchOverIdx.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }

  /** Props a espalhar no elemento raiz de cada item da lista, quando o modo reordenar está ativo. */
  function getItemProps(idx: number) {
    if (!active) return { 'data-reorder-idx': idx };
    return {
      'data-reorder-idx': idx,
      draggable: true,
      onDragStart: handleDragStart(idx),
      onDragEnter: handleDragEnter(idx),
      onDragOver: handleDragOver,
      onDrop: handleDrop(idx),
      onDragEnd: handleDragEnd,
      onTouchStart: handleTouchStart(idx),
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    };
  }

  function isDragging(idx: number) {
    return draggingIdx === idx;
  }

  function isDragOver(idx: number) {
    return dragOverIdx === idx && dragOverIdx !== draggingIdx;
  }

  return { getItemProps, isDragging, isDragOver };
}
