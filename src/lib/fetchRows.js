// PostgREST caps a response at 1,000 rows by default. Read bounded pages so
// large catalogs and account histories are not silently truncated.
export async function fetchRows(makeQuery, signal) {
  const rows = []
  const size = 500
  for (let offset = 0; ; offset += size) {
    let query = makeQuery().range(offset, offset + size - 1)
    if (signal) query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < size) return { data: rows, error: null }
  }
}
