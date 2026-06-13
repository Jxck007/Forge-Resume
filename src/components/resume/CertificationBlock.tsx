import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { resumeLinkLabels } from '../../design-system/resumeSystem';
import { ResumeCertification } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles, safePdfUrl } from './types';

interface CertificationBlockProps extends React.Attributes {
  key?: React.Key;
  certification: ResumeCertification;
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
}

export function CertificationBlock({
  certification,
  styles,
  pagination,
}: CertificationBlockProps) {
  const credentialUrl = safePdfUrl(certification.credentialUrl);
  return (
    <View style={styles.entry} wrap={false} minPresenceAhead={pagination.entry}>
      <View style={styles.entryTop}>
        <Text style={styles.entryTitle}>{certification.name}</Text>
        {certification.date ? <Text style={styles.date}>{certification.date}</Text> : null}
      </View>
      <View style={styles.entryDetailRow}>
        <Text style={styles.entryDetailMeta}>{certification.issuer}</Text>
        {credentialUrl ? (
          <Link src={credentialUrl} style={styles.entryLink}>
            {resumeLinkLabels.credential}
          </Link>
        ) : null}
      </View>
    </View>
  );
}
