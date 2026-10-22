// Hunt number shown in the UI: taken from the title ("Bonus Hunt #12"), falls back to the row id.
export function huntNo(h) {
  const m = String(h?.title || '').match(/#\s*(\d+)/)
  return m ? Number(m[1]) : h?.id
}
