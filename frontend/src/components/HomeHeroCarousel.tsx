import { useCallback, useEffect, useState } from 'react'
import { apiUrl, mediaUrl } from '../lib/api'

type BannerItem = { id: string; imageUrl: string; href: string; alt: string }
type Payload = { strategy: 'STATIC' | 'ROTATE'; items: BannerItem[] }

const AUTO_MS = 6500

export function HomeHeroCarousel({ slot = 'home_top' }: { slot?: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(apiUrl(`/api/v1/banners?slot=${encodeURIComponent(slot)}`))
        const j = (await r.json()) as Payload
        if (!cancelled) {
          setData({
            ...j,
            items: Array.isArray(j.items)
              ? j.items.map((it) => ({ ...it, imageUrl: mediaUrl(it.imageUrl) }))
              : [],
          })
        }
      } catch {
        if (!cancelled) setData({ strategy: 'STATIC', items: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slot])

  const items = data?.items ?? []
  const n = items.length

  const go = useCallback(
    (delta: number) => {
      if (n <= 0) return
      setIdx((i) => (i + delta + n) % n)
    },
    [n],
  )

  useEffect(() => {
    if (n <= 1 || paused) return
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % n)
    }, AUTO_MS)
    return () => window.clearInterval(t)
  }, [n, paused])

  useEffect(() => {
    setIdx(0)
  }, [n])

  if (!data?.items.length) return null

  return (
    <section
      className="mb-8 w-full"
      aria-label="Featured banners"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm ring-1 ring-slate-900/5">
        <div
          className="flex transition-transform duration-500 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {items.map((item) => (
            <div key={item.id} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative aspect-[2.4/1] max-h-[min(42vh,320px)] min-h-[140px] w-full sm:aspect-[2.6/1] sm:min-h-[180px] md:max-h-[min(38vh,360px)]">
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full w-full outline-none ring-emerald-500/0 transition-shadow focus-visible:ring-2"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.alt || 'Promotional banner'}
                      className="h-full w-full object-cover"
                      loading={item.id === items[0]?.id ? 'eager' : 'lazy'}
                    />
                  </a>
                ) : (
                  <img
                    src={item.imageUrl}
                    alt={item.alt || 'Promotional banner'}
                    className="h-full w-full object-cover"
                    loading={item.id === items[0]?.id ? 'eager' : 'lazy'}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {n > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/55 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 sm:left-3 sm:h-10 sm:w-10"
              onClick={() => go(-1)}
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <button
              type="button"
              aria-label="Next slide"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-slate-900/55 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900/75 sm:right-3 sm:h-10 sm:w-10"
              onClick={() => go(1)}
            >
              <span className="text-lg leading-none" aria-hidden>
                ›
              </span>
            </button>
          </>
        ) : null}
      </div>

      {n > 1 ? (
        <div className="mt-3 flex justify-center gap-2" role="tablist" aria-label="Banner slides">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Slide ${i + 1} of ${n}`}
              className={`h-2 rounded-full transition-all ${
                i === idx ? 'w-6 bg-emerald-600' : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
