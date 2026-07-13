export function fmtSum(value: number | string, compact = false): string {
  const n = Number(value)
  if (compact) {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
    return String(Math.round(n))
  }
  return new Intl.NumberFormat('ru-RU').format(Math.round(n))
}


export function fmtWeight(value: string | number): string {
  return `${parseFloat(String(value)).toFixed(0)} kg`
}

export function fmtDate(dateStr: string, short = false): string {
  const date = new Date(dateStr)
  if (short) return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Hozir'
  if (mins < 60) return `${mins} min oldin`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} soat oldin`
  return `${Math.floor(hours / 24)} kun oldin`
}

export function agentInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('')
}

export function agentShortName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName.charAt(0)}.`
}

/** Son — bo'sh joy bilan ajratilgan (12 345). Prognoz bo'limida ishlatiladi. */
export function fmt(value: number | string | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('ru-RU').format(Math.round(Number(value)))
}
