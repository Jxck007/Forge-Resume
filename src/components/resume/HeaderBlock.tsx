import React from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import { PersonalDetails } from '../../types';
import { ContactRow } from './ContactRow';
import { ResumePrimitiveStyles } from './types';

interface HeaderBlockProps {
  details: PersonalDetails;
  photoSource?: string;
  usePhoto: boolean;
  styles: ResumePrimitiveStyles;
}

export function HeaderBlock({
  details,
  photoSource,
  usePhoto,
  styles,
}: HeaderBlockProps) {
  return (
    <View style={styles.header} wrap={false}>
      <View style={styles.headerCopy}>
        <Text style={styles.name}>{details.fullName || 'Your Name'}</Text>
        {details.professionalTitle ? (
          <Text style={styles.title}>{details.professionalTitle}</Text>
        ) : null}
        <ContactRow details={details} styles={styles} />
      </View>
      {usePhoto && photoSource ? <Image src={photoSource} style={styles.photo} /> : null}
    </View>
  );
}
