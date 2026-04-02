export const currencyUtils = {
  format(value, locale = 'pt-BR', currency = 'BRL') {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(value);
  },

  parse(str) {
    // Remove R$, pontos e substitui vírgula por ponto
    return parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  },
};
