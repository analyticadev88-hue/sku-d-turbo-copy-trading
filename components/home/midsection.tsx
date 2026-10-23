import Image from 'next/image'

export function Midsection() {
  return (
    <section
      aria-label="SkuD Turbo on mobile"
      className="relative h-[65vh] overflow-hidden md:h-[85vh]"
    >
      <Image
        src="/images/midsection.png"
        alt="The SkuD Turbo sign-in and Deriv MT5 account screens on two phones"
        fill
        sizes="100vw"
        className="object-cover object-center"
      />
    </section>
  )
}
