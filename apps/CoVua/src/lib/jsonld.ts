import { brand } from '@ds/brand';
import type { Location } from '@/payload-types';
import { absoluteUrl, getSiteUrl } from '@/lib/seo';
import { normalizePhone } from '@/lib/phone';

function toE164Phone(phone: string): string {
  const digits = normalizePhone(phone);

  if (digits.startsWith('+')) {
    return digits;
  }

  if (digits.startsWith('84')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+84${digits.slice(1)}`;
  }

  return digits;
}

export function buildOrganizationJsonLd() {
  const siteUrl = getSiteUrl();
  const facebookUrl = brand.facebook.startsWith('http')
    ? brand.facebook
    : `https://${brand.facebook}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.fullName,
    alternateName: brand.name,
    url: siteUrl,
    logo: absoluteUrl('/og-default.svg'),
    slogan: brand.slogan,
    email: brand.email,
    sameAs: [facebookUrl],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: toE164Phone(brand.hotline),
      contactType: 'customer service',
      email: brand.email,
      availableLanguage: ['Vietnamese', 'English'],
    },
  };
}

export function buildLocalBusinessJsonLd(location: Location) {
  const siteUrl = getSiteUrl();
  const phone = location.phone || brand.hotline;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `${brand.name} — ${location.name}`,
    description: `${brand.fullName} — ${location.name}`,
    url: `${siteUrl}/co-so`,
    telephone: toE164Phone(phone),
    parentOrganization: {
      '@type': 'Organization',
      name: brand.fullName,
      url: siteUrl,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.address,
      addressCountry: 'VN',
    },
  };

  if (location.lat != null && location.lng != null) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: location.lat,
      longitude: location.lng,
    };
  }

  return schema;
}

export function buildStructuredDataGraph(locations: Location[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildOrganizationJsonLd(),
      ...locations.map((location) => buildLocalBusinessJsonLd(location)),
    ],
  };
}
