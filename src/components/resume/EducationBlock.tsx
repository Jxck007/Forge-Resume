import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { ResumeEducation } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';

interface EducationBlockProps extends React.Attributes {
  key?: React.Key;
  education: ResumeEducation;
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
}

export function EducationBlock({
  education,
  styles,
  pagination,
}: EducationBlockProps) {
  const metadata = [
    education.institution,
    education.location,
    education.gpaOrPercentage,
  ].filter(Boolean).join(' | ');

  return (
    <View style={styles.entry} wrap minPresenceAhead={pagination.entry}>
      <View style={styles.entryTop}>
        <Text style={styles.entryTitle}>{education.degree}</Text>
        {education.date ? <Text style={styles.date}>{education.date}</Text> : null}
      </View>
      {metadata ? <Text style={styles.metadata}>{metadata}</Text> : null}
      {education.description ? (
        <Text
          style={styles.description}
          orphans={pagination.orphans}
          widows={pagination.widows}
        >
          {education.description}
        </Text>
      ) : null}
    </View>
  );
}
