import React from 'react'
import { useCountUp } from '../../utils/typewriter'
import { getYearsMonths } from '../../utils/dates'

/**
 * Renders the relative-time label for a milestone with numbers that
 * count up from 0 when the component mounts.
 * Mirrors the format logic of relativeLabel() exactly.
 */
function AnimatedNumber({ value }) {
  const disp = useCountUp(value, { duration: 420, active: true })
  return <>{disp}</>
}

export default function AnimatedRelLabel({ dateStr }) {
  const { years, months, days, past } = getYearsMonths(dateStr)

  if (years > 0 && months > 0) {
    return past
      ? <><AnimatedNumber value={years} />年<AnimatedNumber value={months} />个月前</>
      : <>还有<AnimatedNumber value={years} />年<AnimatedNumber value={months} />个月</>
  }
  if (years > 0) {
    return past
      ? <><AnimatedNumber value={years} />年前</>
      : <>还有<AnimatedNumber value={years} />年</>
  }
  if (days > 30) {
    const mo = Math.floor(days / 30)
    return past
      ? <><AnimatedNumber value={mo} />个月前</>
      : <>还有<AnimatedNumber value={mo} />个月</>
  }
  if (days > 0) {
    return past
      ? <><AnimatedNumber value={days} />天前</>
      : <>还有<AnimatedNumber value={days} />天</>
  }
  return <>今天</>
}
