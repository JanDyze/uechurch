/**
 * Money is stored as an integer number of centavos, never as pesos in a float.
 *
 * A statement is nothing but sums, and floats do not sum cleanly: ten entries
 * of ₱0.10 come to 0.9999999999999999. Storing 10 and adding integers is exact,
 * and the only place the decimal point exists is on the way in and out.
 */

/** 123456 -> "1,234.56". No symbol, for table columns that carry their own. */
export const formatAmount = (centavos) => {
  const n = Math.trunc(Number(centavos) || 0)
  const negative = n < 0
  const abs = Math.abs(n)
  const pesos = Math.trunc(abs / 100)
  const cents = abs % 100
  const grouped = pesos.toLocaleString('en-PH')
  return `${negative ? '-' : ''}${grouped}.${String(cents).padStart(2, '0')}`
}

/** 123456 -> "₱1,234.56"; a negative reads "-₱3,100.00", sign outside. */
export const formatMoney = (centavos) => {
  const text = formatAmount(centavos)
  return text.startsWith('-') ? `-₱${text.slice(1)}` : `₱${text}`
}

/** 123456 -> 1234.56. Only for handing a number to something that wants pesos. */
export const toPesos = (centavos) => (Math.trunc(Number(centavos) || 0)) / 100

/**
 * What someone typed -> centavos. Accepts "1,234.56", "1234.5", "₱1,234", "".
 *
 * Parsed as two integers rather than `Number(x) * 100`, which rounds the wrong
 * way on some values a treasurer will genuinely type — 1234.565 * 100 is
 * 123456.49999999999 in a double, and would silently lose a centavo.
 */
export const parseAmount = (input) => {
  const clean = String(input ?? '').replace(/[^\d.-]/g, '')
  if (!clean || clean === '-' || clean === '.') return 0

  const negative = clean.startsWith('-')
  const [whole = '', frac = ''] = clean.replace(/-/g, '').split('.')
  const pesos = Number(whole || '0')
  const cents = Number((frac + '00').slice(0, 2))
  if (!Number.isFinite(pesos) || !Number.isFinite(cents)) return 0

  const total = pesos * 100 + cents
  return negative ? -total : total
}

/** Exact, because the operands are integers. */
export const sumAmounts = (values = []) =>
  values.reduce((total, value) => total + (Math.trunc(Number(value) || 0)), 0)

/** For an <input type="number"> bound to pesos, so editing shows "1234.56". */
export const centavosToInput = (centavos) =>
  centavos === null || centavos === undefined || centavos === '' ? '' : toPesos(centavos).toFixed(2)
