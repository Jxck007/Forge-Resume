import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { PersonalDetails, ResumeData } from '../../types';
import { ResumePrimitiveStyles } from './types';
import { formatResumeLink, resolveLinkDisplayMode } from '../../utils/linkDisplay';

interface ContactRowProps {
  details: PersonalDetails;
  linkDisplayMode: ResumeData['linkDisplayMode'];
  styles: ResumePrimitiveStyles;
}

export function ContactRow({ details, linkDisplayMode, styles }: ContactRowProps) {
  const displayMode = resolveLinkDisplayMode({ linkDisplayMode });
  const contacts = [
    details.phone
      ? { label: details.phone, url: `tel:${details.phone.replace(/\s+/g, '')}` }
      : null,
    details.email ? { label: details.email, url: `mailto:${details.email}` } : null,
    details.location ? { label: details.location } : null,
    formatResumeLink({ href: details.linkedin, kind: 'linkedin' }, displayMode),
    formatResumeLink({ href: details.github, kind: 'github' }, displayMode),
    formatResumeLink({ href: details.website, kind: 'portfolio' }, displayMode),
  ].filter(Boolean) as Array<{ label: string; url?: string }>;

  if (contacts.length === 0) return null;

  return (
    <View style={styles.contactRow}>
      {contacts.map((contact, index) => (
        <View key={`${contact.label}-${index}`} style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
          {index > 0 ? <Text style={styles.contactSeparator}>{'\u2022 '}</Text> : null}
          {contact.url ? (
            <Link src={contact.url} style={styles.link}>
              {contact.label}
            </Link>
          ) : (
            <Text style={styles.contactItem}>{contact.label}</Text>
          )}
        </View>
      ))}
    </View>
  );
}
