// Calcul du contraste WCAG entre deux couleurs hexadécimales (utilisé par les tests, module D).

function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const canal = parseInt(n.slice(i, i + 2), 16) / 255
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (clair + 0.05) / (sombre + 0.05)
}
