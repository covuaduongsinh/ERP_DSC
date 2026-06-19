import { getPayloadClient } from '@/lib/payload';
import { buildStructuredDataGraph } from '@/lib/jsonld';

export async function StructuredData() {
  const payload = await getPayloadClient();

  const { docs: locations } = await payload.find({
    collection: 'locations',
    limit: 3,
    sort: '-isHeadquarters',
  });

  const graph = buildStructuredDataGraph(locations);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
