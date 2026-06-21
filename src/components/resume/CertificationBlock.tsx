import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { ResumeCertification } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';
import { ResumeData } from '../../types';
import { formatResumeLink, resolveLinkDisplayMode } from '../../utils/linkDisplay';

interface CertificationBlockProps extends React.Attributes {
  key?: React.Key;
  certification: ResumeCertification;
  linkDisplayMode: ResumeData['linkDisplayMode'];
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
}

export function CertificationBlock({
  certification,
  linkDisplayMode,
  styles,
  pagination,
}: CertificationBlockProps) {
  const displayMode = resolveLinkDisplayMode({ linkDisplayMode });
  const credentialLink = formatResumeLink({ href: certification.credentialUrl, kind: 'certificate' }, displayMode);
  return (
    <View style={styles.entry} wrap minPresenceAhead={pagination.entry}>
      <View style={styles.entryTop}>
        <Text style={styles.entryTitle}>{certification.name}</Text>
        {certification.date ? <Text style={styles.date}>{certification.date}</Text> : null}
      </View>
      {(certification.issuer || credentialLink) ? (
        <View style={[styles.entryDetailRow, { justifyContent: 'flex-start' }]}>
          {certification.issuer ? <Text style={styles.entryDetailMeta}>{certification.issuer}</Text> : null}
          {credentialLink ? (
            <View style={[styles.inlineLinks, { justifyContent: 'flex-start', flexWrap: 'wrap', flexShrink: 1 }]}>
              {certification.issuer ? <Text style={styles.contactSeparator}>{'•'}</Text> : null}
              <Link src={credentialLink.url} style={styles.entryLink}>
                {credentialLink.label}
              </Link>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
