import { Medal } from './Medal'

// Rank badge before a username. Renders just the name until the level is known.
export default function RankName({ name, level, size = 18, className, children }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {level !== undefined && <Medal level={level} size={size} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{children}</span>
    </span>
  )
}
