import React from 'react';
import { Image, Text, View } from '@react-pdf/renderer';
import { PersonalDetails, ResumeData } from '../../types';
import { ContactRow } from './ContactRow';
import { ResumePrimitiveStyles } from './types';

interface HeaderBlockProps {
  details: PersonalDetails;
  linkDisplayMode: ResumeData['linkDisplayMode'];
  photoSource?: string;
  usePhoto: boolean;
  styles: ResumePrimitiveStyles;
}

export function HeaderBlock({
  details,
  linkDisplayMode,
  photoSource,
  usePhoto,
  styles,
}: HeaderBlockProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.name}>{details.fullName || 'Your Name'}</Text>
        {details.professionalTitle ? (
          <Text style={styles.title}>{details.professionalTitle}</Text>
        ) : null}
        <ContactRow details={details} linkDisplayMode={linkDisplayMode} styles={styles} />
      </View>
      {usePhoto && photoSource ? <Image src={photoSource} style={styles.photo} /> : null}
    </View>
  );
}
