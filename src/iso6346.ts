/** ISO 6346 container number validation */

const CONTAINER_PATTERN = /^[A-Z]{3}[UJZ]\d{7}$/

const LETTER_VALUES: Record<string, number> = {
  A: 10, B: 12, C: 13, D: 14, E: 15, F: 16, G: 17, H: 18, I: 19,
  J: 20, K: 21, L: 23, M: 24, N: 25, O: 26, P: 27, Q: 28, R: 29,
  S: 30, T: 31, U: 32, V: 34, W: 35, X: 36, Y: 37, Z: 38,
}

export function normalizeContainerNumber(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '')
}

export function isValidContainerFormat(containerNumber: string): boolean {
  return CONTAINER_PATTERN.test(containerNumber)
}

export function isValidCheckDigit(containerNumber: string): boolean {
  if (!isValidContainerFormat(containerNumber)) return false

  let sum = 0
  for (let i = 0; i < 10; i++) {
    const char = containerNumber[i]
    const value = i < 4 ? LETTER_VALUES[char] : Number(char)
    sum += value * Math.pow(2, i)
  }

  const remainder = sum % 11
  const checkDigit = remainder === 10 ? 0 : remainder
  return checkDigit === Number(containerNumber[10])
}

export type ValidationResult =
  | { ok: true; containerNumber: string }
  | { ok: false; message: string }

export function validateContainerNumber(input: string): ValidationResult {
  const containerNumber = normalizeContainerNumber(input)

  if (!containerNumber) {
    return { ok: false, message: 'נא להזין מספר מכולה.' }
  }

  if (!isValidContainerFormat(containerNumber)) {
    return {
      ok: false,
      message:
        'מספר המכולה אינו תקין לפי תקן ISO 6346. הפורמט הנדרש: 4 אותיות ו-7 ספרות (לדוגמה MSCU1234567).',
    }
  }

  if (!isValidCheckDigit(containerNumber)) {
    return {
      ok: false,
      message: 'ספרת הביקורת במספר המכולה אינה תקינה. נא לוודא את המספר.',
    }
  }

  return { ok: true, containerNumber }
}
