const pillars = [
  {
    title: 'Pioneer',
    body: 'One of the early voices bringing automated forex and synthetic-index trading to his community.',
  },
  {
    title: 'Discipline',
    body: 'Every rule inside the robot comes from years of live-market screen time and strict risk control.',
  },
  {
    title: 'Mentor',
    body: 'Skud built Turbo so traders could follow his execution without sitting at a chart all day.',
  },
]

export function Founder() {
  return (
    <section
      id="founder"
      className="mx-auto flex w-full max-w-6xl scroll-mt-8 flex-col gap-12 px-5 py-20 md:px-10 md:py-28"
      aria-labelledby="founder-title"
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-16">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-primary">The founder</p>
          <h2
            id="founder-title"
            className="text-balance text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-6xl"
          >
            Skud — the trader behind the machine.
          </h2>
        </div>
        <p className="max-w-md text-pretty leading-relaxed text-muted-foreground">
          Skud is a highly profitable forex trader and a pioneer of the copy-trading scene. He took the
          strategy that built his results and encoded it into SkuD Turbo, so the same entries, exits and
          risk rules can run on your account.
        </p>
      </div>

      <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
        {pillars.map((p) => (
          <li key={p.title} className="flex flex-col gap-3 bg-background p-6 md:p-8">
            <h3 className="text-2xl font-extrabold uppercase tracking-tight text-foreground">
              {p.title}
              <span className="text-primary">.</span>
            </h3>
            <p className="leading-relaxed text-muted-foreground">{p.body}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
