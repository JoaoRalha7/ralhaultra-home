// Product picture: an image, or a looping (transparent) video when the file is a .webm / .mp4.
export const isVideoUrl = (u) => /\.(webm|mp4)(\?|#|$)/i.test(String(u || ''))

export default function ProductMedia({ src, className, style }) {
  if (!src) return null
  return isVideoUrl(src)
    ? <video src={src} className={className} style={style} autoPlay loop muted playsInline preload="auto" aria-hidden="true" />
    : <img src={src} alt="" className={className} style={style} loading="lazy" />
}
