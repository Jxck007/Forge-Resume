import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { ResumeSkillsVariant } from '../../design-system/resumeSystem';
import { ResumeSkillBlock } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';

interface SkillsBlockProps extends React.Attributes {
  key?: React.Key;
  heading: string;
  skills: ResumeSkillBlock;
  variant: ResumeSkillsVariant;
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
  terminal?: boolean;
}

export function SkillsBlock({
  heading,
  skills,
  variant,
  styles,
  pagination,
  terminal = false,
}: SkillsBlockProps) {
  const rows = [
    ['Languages', skills.languages],
    ['Frameworks', skills.frameworks],
    ['Tools', skills.tools],
    ['Databases', skills.databases],
    ['Concepts', skills.concepts],
  ].filter(([, values]) => (values as string[]).length > 0) as [string, string[]][];

  if (rows.length === 0) return null;

  return (
    <View
      style={[styles.section, terminal ? styles.terminalSection : null]}
      wrap
      minPresenceAhead={pagination.section}
    >
      <Text style={styles.sectionHeading} minPresenceAhead={pagination.heading}>
        {heading}
      </Text>
      <View style={variant === 'compact-grid' ? styles.compactSkillGrid : styles.skillRows}>
        {rows.map(([label, values]) => (
          <View
            key={label}
            style={variant === 'compact-grid' ? styles.compactSkillGroup : styles.skillRow}
            wrap
          >
            <Text style={styles.skillLabel}>{label}:</Text>
            <Text style={styles.skillValues}>{values.join(', ')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
