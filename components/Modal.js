/**
 * Modal reutilizável.
 * Uso: Modal.open({ title, content, onConfirm })
 */
export const Modal = {
  _el: null,

  init() {
    if (document.getElementById('psiclo-modal')) return;
    const el = document.createElement('div');
    el.id = 'psiclo-modal';
    el.className = 'modal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__box">
        <header class="modal__header">
          <h2 class="modal__title"></h2>
          <button class="modal__close" aria-label="Fechar">×</button>
        </header>
        <div class="modal__body"></div>
        <footer class="modal__footer">
          <button class="btn btn--ghost modal__cancel">Cancelar</button>
          <button class="btn btn--primary modal__confirm">Confirmar</button>
        </footer>
      </div>
    `;
    document.body.appendChild(el);
    this._el = el;

    el.querySelector('.modal__close').addEventListener('click', () => this.close());
    el.querySelector('.modal__cancel').addEventListener('click', () => this.close());
    el.querySelector('.modal__backdrop').addEventListener('click', () => this.close());
  },

  open({ title, content, onConfirm, confirmLabel = 'Confirmar', hideFooter = false }) {
    this.init();
    // title é sempre texto puro — nunca HTML
    this._el.querySelector('.modal__title').textContent = title;
    this._el.querySelector('.modal__body').innerHTML = '';

    // content é HTML de formulário (código nosso, não dado do usuário).
    // Dados do servidor inseridos em content DEVEM ser escapados com esc() antes de passar aqui.
    if (typeof content === 'string') {
      this._el.querySelector('.modal__body').innerHTML = content;
    } else {
      this._el.querySelector('.modal__body').appendChild(content);
    }

    const footer = this._el.querySelector('.modal__footer');
    footer.style.display = hideFooter ? 'none' : '';

    const confirmBtn = this._el.querySelector('.modal__confirm');
    confirmBtn.textContent = confirmLabel;
    confirmBtn.onclick = () => {
      if (onConfirm) onConfirm();
      this.close();
    };

    this._el.classList.add('modal--open');
    document.body.style.overflow = 'hidden';
  },

  close() {
    if (this._el) {
      this._el.classList.remove('modal--open');
      document.body.style.overflow = '';
    }
  },
};
