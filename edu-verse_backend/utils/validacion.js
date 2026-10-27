const aEnteroPositivo = (valor) => {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
};

module.exports = { aEnteroPositivo };
