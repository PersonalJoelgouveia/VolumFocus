import { useProgressStore } from '../../store/useProgressStore';
import './ProgressPopup.css';

/** Sucessor de `#prg-popup` (index.html ~3304-3308) e prgCheck._showPopup(). */
export function ProgressPopup() {
  const isOpen = useProgressStore((s) => s.isPopupOpen);
  const messages = useProgressStore((s) => s.popupMessages);
  const closePopup = useProgressStore((s) => s.closePopup);

  if (!isOpen) return null;

  return (
    <div
      className="prg-popup prg-popup-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) closePopup();
      }}
    >
      <div className="prg-popup-card">
        <div className="prg-popup-msgs">
          {messages.map((m, i) => (
            <div className="prg-popup-msg" key={i}>
              <span className="prg-popup-msg-icon">{m.icon}</span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
        <button className="btn btn-primary prg-popup-close" onClick={closePopup}>
          Entendi
        </button>
      </div>
    </div>
  );
}
