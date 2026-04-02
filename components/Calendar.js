/**
 * Componente de Calendário.
 * Renderiza um mês com estados: disponível, indisponível, hoje, selecionado.
 * 
 * Uso:
 *   const cal = new Calendar(containerEl, { onDateSelect, unavailableDays })
 *   cal.render()
 */
export class Calendar {
  constructor(container, options = {}) {
    this.container = container;
    this.onDateSelect = options.onDateSelect || (() => {});
    this.unavailableDays = options.unavailableDays || []; // array de day-of-week (0-6)
    this.currentDate = new Date();
    this.selectedDate = null;
  }

  render() {
    this.container.innerHTML = '';
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const header = this._buildHeader(year, month);
    const grid = this._buildGrid(year, month);

    this.container.appendChild(header);
    this.container.appendChild(grid);
  }

  _buildHeader(year, month) {
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const header = document.createElement('div');
    header.className = 'calendar__header';
    header.innerHTML = `
      <button class="calendar__nav" data-dir="-1" aria-label="Mês anterior">‹</button>
      <span class="calendar__month-label">${months[month]} ${year}</span>
      <button class="calendar__nav" data-dir="1" aria-label="Próximo mês">›</button>
    `;
    header.querySelectorAll('.calendar__nav').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.currentDate.setMonth(this.currentDate.getMonth() + Number(btn.dataset.dir));
        this.render();
      });
    });
    return header;
  }

  _buildGrid(year, month) {
    const grid = document.createElement('div');
    grid.className = 'calendar__grid';

    const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    dayNames.forEach((d) => {
      const cell = document.createElement('div');
      cell.className = 'calendar__day-name';
      cell.textContent = d;
      grid.appendChild(cell);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Células vazias antes do primeiro dia
    for (let i = 0; i < firstDay; i++) {
      grid.appendChild(this._emptyCell());
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      const isUnavailable = this.unavailableDays.includes(dayOfWeek);
      const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = this.selectedDate?.toDateString() === date.toDateString();

      const cell = document.createElement('button');
      cell.className = 'calendar__day';
      cell.textContent = day;
      cell.setAttribute('aria-label', date.toLocaleDateString('pt-BR'));

      if (isToday) cell.classList.add('calendar__day--today');
      if (isSelected) cell.classList.add('calendar__day--selected');

      if (isUnavailable || isPast) {
        cell.classList.add('calendar__day--unavailable');
        cell.disabled = true;
        cell.setAttribute('aria-disabled', 'true');
      } else {
        cell.addEventListener('click', () => {
          this.selectedDate = date;
          this.render();
          this.onDateSelect(date);
        });
      }

      grid.appendChild(cell);
    }

    return grid;
  }

  _emptyCell() {
    const cell = document.createElement('div');
    cell.className = 'calendar__day calendar__day--empty';
    return cell;
  }
}
