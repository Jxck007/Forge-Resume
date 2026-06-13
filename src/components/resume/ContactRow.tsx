import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { resumeLinkLabels } from '../../design-system/resumeSystem';
import { PersonalDetails } from '../../types';
import { ResumePrimitiveStyles, safePdfUrl } from './types';

interface ContactRowProps {
  details: PersonalDetails;
  styles: ResumePrimitiveStyles;
}

export function ContactRow({ details, styles }: ContactRowProps) {
  const contacts = [
    details.phone
      ? { label: details.phone, url: `tel:${details.phone.replace(/\s+/g, '')}` }
      : null,
    details.email ? { label: details.email, url: `mailto:${details.email}` } : null,
    details.location ? { label: details.location } : null,
    details.linkedin
      ? { label: resumeLinkLabels.linkedin, url: safePdfUrl(details.linkedin) }
      : null,
    details.github ? { label: resumeLinkLabels.github, url: safePdfUrl(details.github) } : null,
    details.website
      ? { label: resumeLinkLabels.portfolio, url: safePdfUrl(details.website) }
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
