import { ConsultationForm } from '@/components/forms/ConsultationForm'
import { getPayloadClient } from '@/lib/payload'

export async function ConsultSection() {
  const payload = await getPayloadClient()

  const { docs: locations } = await payload.find({
    collection: 'locations',
    limit: 10,
    sort: '-isHeadquarters',
  })

  return (
    <section id="tu-van" className="scroll-mt-20 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <ConsultationForm locations={locations} />
      </div>
    </section>
  )
}
