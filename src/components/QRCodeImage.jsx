import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

function buildJoinUrl(code) {
  const origin = window.location?.origin ?? ''
  return `${origin}/join?code=${encodeURIComponent(code)}`
}

export default function QRCodeImage({ code, url, className }) {
  const target = url ?? buildJoinUrl(code)
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(target, { margin: 1, width: 220 })
      .then(dataUrl => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [target])

  return <img src={src} alt="QR 코드" className={className} />
}
