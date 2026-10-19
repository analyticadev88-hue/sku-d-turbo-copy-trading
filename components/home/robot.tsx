import { Bot, Link2, ShieldCheck } from 'lucide-react'
import { InstallAppButton } from '@/components/pwa/install-app-button'

const steps = [
  {
    icon: Link2,
    title: 'Connect Deriv MT5',
    body: 'Enter your Deriv MT5 login and server. Your password never leaves the secure link.',
  },
  {
    icon: Bot,
    title: 'Turbo takes the trades',
    body: 'The robot mirrors Skud’s strategy in real time, sized to the lot multiplier you choose.',
  },
  {
    icon: ShieldCheck,
    title: 'You stay in control',
    body: 'Pause copying, change risk or disconnect at any moment from your dashboard.',
  },
]

export function Robot() {
  return (
    <section className="bg-secondary text-secondary-foreground" aria-labelledby="robot-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 py-20 md:px-10 md:py-28">
        <div className="flex flex-col gap-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-primary">The robot</p>
          <h2
            id="robot-title"
            className="max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight md:text-6xl"
          >
            A high-performance trading robot, switched on in three steps.
          </h2>
        </div>

        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.title} className="flex flex-col gap-4 border-t-4 border-primary pt-6">
              <s.icon className="size-6 text-primary" aria-hidden="true" />
              <h3 className="text-xl font-extrabold">{s.title}</h3>
              <p className="leading-relaxed text-secondary-foreground/70">{s.body}</p>
            </li>
          ))}
        </ol>

        <InstallAppButton
          label="Install the app"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-extrabold uppercase tracking-wider text-primary-foreground transition-transform hover:scale-[1.03]"
        />
      </div>
    </section>
  )
}
