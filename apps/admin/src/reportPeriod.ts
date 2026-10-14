// Reporting uses the operation's calendar, independently of the browser timezone.
export function reportPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(value => value.type === type)!.value
  const end = `${part('year')}-${part('month')}-${part('day')}`
  const start = new Date(`${end}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - 6)
  return { start: start.toISOString().slice(0, 10), end }
}
