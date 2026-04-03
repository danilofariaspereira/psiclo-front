export const dateUtils = {
  format(isoString, locale = 'pt-BR') {
    return new Date(isoString).toLocaleDateString(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  formatTime(isoString, locale = 'pt-BR') {
    // Se não tem timezone explícito, trata como horário local (sem conversão UTC)
    const str = isoString.includes('+') || isoString.endsWith('Z')
      ? isoString
      : isoString + '-03:00'; // Brasília
    return new Date(str).toLocaleTimeString(locale, {
      hour: '2-digit', minute: '2-digit',
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
