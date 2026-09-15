export function isValidEpisodeNumber(value) {
  return Number.isInteger(value) && value > 0
}

function timeValue(episode, field) {
  const parsed = episode?.[field] ? Date.parse(episode[field]) : NaN
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

// A flat podcast list has one sequence. Stored episode numbers decide the
// order when they are valid; dates and IDs make incomplete legacy data stable.
export function compareEpisodes(a, b) {
  const aNumber = isValidEpisodeNumber(a.episode_number) ? a.episode_number : null
  const bNumber = isValidEpisodeNumber(b.episode_number) ? b.episode_number : null
  if (aNumber != null && bNumber != null && aNumber !== bNumber) return aNumber - bNumber
  if (aNumber != null && bNumber == null) return -1
  if (aNumber == null && bNumber != null) return 1
  const published = timeValue(a, 'published_at') - timeValue(b, 'published_at')
  if (published) return published
  const created = timeValue(a, 'created_at') - timeValue(b, 'created_at')
  if (created) return created
  return String(a.id || '').localeCompare(String(b.id || ''))
}

export function orderEpisodes(episodes) {
  return [...episodes].sort(compareEpisodes)
}

export function nextEpisodeNumber(episodes) {
  return episodes.reduce((highest, episode) => isValidEpisodeNumber(episode.episode_number)
    ? Math.max(highest, episode.episode_number)
    : highest, 0) + 1
}

export function numberImportedEpisodes(episodes, existingEpisodes = []) {
  let next = nextEpisodeNumber([...existingEpisodes, ...episodes])
  return orderEpisodes(episodes).map(episode => isValidEpisodeNumber(episode.episode_number)
    ? episode
    : { ...episode, episode_number: next++ })
}
