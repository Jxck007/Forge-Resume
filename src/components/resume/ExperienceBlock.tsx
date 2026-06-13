import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { ResumeExperience } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';

interface ExperienceBlockProps extends React.Attributes {
  key?: React.Key;
  experience: ResumeExperience;
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
}

export function ExperienceBlock({
  experience,
  styles,
  pagination,
}: ExperienceBlockProps) {
  return (
    <View style={styles.entry} wrap minPresenceAhead={pagination.entry}>
      <View style={styles.entryTop} wrap={false}>
        <Text style={styles.entryTitle}>
          {[experience.role, experience.company].filter(Boolean).join(' - ')}
        </Text>
        {experience.date ? <Text style={styles.date}>{experience.date}</Text> : null}
      </View>
      {experience.location || experience.details ? (
        <Text style={styles.metadata}>
          {[experience.location, experience.details].filter(Boolean).join(' | ')}
        </Text>
      ) : null}
      {experience.bullets.map((bullet, index) => (
        <View key={`${experience.id}-bullet-${index}`} style={styles.listItem}>
          <Text style={styles.bullet}>{'\u2022'}</Text>
          <Text
            style={styles.description}
            orphans={pagination.orphans}
            widows={pagination.widows}
          >
            {bullet}
          </Text>
        </View>
      ))}
    </View>
  );
}
