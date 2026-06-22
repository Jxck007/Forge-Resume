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
  showContact?: boolean;
}

export function HeaderBlock({
  details,
  linkDisplayMode,
  photoSource,
  usePhoto,
  styles,
  showContact = true,
}: HeaderBlockProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.name}>{details.fullName || 'Your Name'}</Text>
        {details.professionalTitle ? (
          <Text style={styles.title}>{details.professionalTitle}</Text>
        ) : null}
        {showContact ? <ContactRow details={details} linkDisplayMode={linkDisplayMode} styles={styles} /> : null}
      </View>
      {usePhoto && photoSource ? <Image src={photoSource} style={styles.photo} /> : null}
    </View>
  );
}
