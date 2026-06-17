import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { PersonalDetails, ResumeData } from '../../types';
import { ResumePrimitiveStyles, safePdfUrl } from './types';

interface ContactRowProps {
  details: PersonalDetails;
  linkDisplayMode: ResumeData['linkDisplayMode'];
  styles: ResumePrimitiveStyles;
}

export function ContactRow({ details, linkDisplayMode, styles }: ContactRowProps) {
  const contacts = [
    details.phone
      ? { label: details.phone, url: `tel:${details.phone.replace(/\s+/g, '')}` }
      : null,
    details.email ? { label: details.email, url: `mailto:${details.email}` } : null,
    details.location ? { label: details.location } : null,
    details.linkedin
      ? {
          label: linkDisplayMode === 'raw' ? safePdfUrl(details.linkedin) : 'LinkedIn: View Profile',
          url: safePdfUrl(details.linkedin),
        }
      : null,
    details.github
      ? {
          label: linkDisplayMode === 'raw' ? safePdfUrl(details.github) : 'GitHub: Click here',
          url: safePdfUrl(details.github),
        }
      : null,
    details.website
      ? {
          label: linkDisplayMode === 'raw' ? safePdfUrl(details.website) : 'Portfolio: Visit site',
          url: safePdfUrl(details.website),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; url?: string }>;

  if (contacts.length === 0) return null;

  return (
    <View style={styles.contactRow} wrap={false}>
      {contacts.map((contact, index) => (
        <React.Fragment key={`${contact.label}-${index}`}>
          {index > 0 ? <Text style={styles.contactSeparator}>{'\u2022'}</Text> : null}
          {contact.url ? (
            <Link src={contact.url} style={styles.link}>
              {contact.label}
            </Link>
          ) : (
            <Text style={styles.contactItem}>{contact.label}</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}
