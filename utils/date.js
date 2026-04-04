export const dateUtils = {
  format(isoString, locale = 'pt-BR') {
    return new Date(isoString).toLocaleDateString(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  formatTime(isoString, locale = 'pt-BR') {
    return new Date(isoString).toLocaleTimeString(locale, {
      hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
  },

  formatDateTime(isoString, locale = 'pt-BR') {
    return new Date(isoString).toLocaleString(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  },

  toInputDate(isoString) {
    return isoString.split('T')[0];
  },

  isToday(isoString) {
    const today = new Date().toISOString().split('T')[0];
    return isoString.startsWith(today);
  },

  isPast(isoString) {
    return new Date(isoString) < new Date();
  },
};
