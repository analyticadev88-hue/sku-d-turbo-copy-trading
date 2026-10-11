const items = [
  'EUR/USD',
  'GBP/USD',
  'XAU/USD',
  'USD/JPY',
  'Volatility 75',
  'Boom 1000',
  'Crash 500',
  'GBP/JPY',
]

export function Ticker() {
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden border-y border-primary bg-primary py-3" aria-hidden="true">
      <div className="flex w-max animate-[ticker_30s_linear_infinite] gap-10 motion-reduce:animate-none">
        {row.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-sm font-extrabold uppercase tracking-[0.2em] text-primary-foreground"
          >
            {item}
            <span className="size-1.5 rounded-full bg-primary-foreground/70" />
          </span>
        ))}
      </div>
    </div>
  )
}
