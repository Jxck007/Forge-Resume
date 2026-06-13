import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { ResumeTemplatePlan } from '../../design-system/resumeSystem';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';

interface SummaryBlockProps extends React.Attributes {
  key?: React.Key;
  summary: string;
  plan: ResumeTemplatePlan;
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
  terminal?: boolean;
}

export function SummaryBlock({
  summary,
  plan,
  styles,
  pagination,
  terminal = false,
}: SummaryBlockProps) {
  if (!summary) return null;
  return (
    <View
      style={[styles.section, terminal ? styles.terminalSection : null]}
      wrap
      minPresenceAhead={pagination.section}
    >
      <Text style={styles.sectionHeading} minPresenceAhead={pagination.heading}>
        {plan.family === 'student'
          ? 'Profile'
          : plan.summaryStyle === 'executive'
            ? 'Executive Summary'
            : 'Professional Summary'}
      </Text>
      <Text
        style={plan.summaryStyle === 'executive' ? styles.executiveSummary : styles.summary}
        orphans={pagination.orphans}
        widows={pagination.widows}
      >
        {summary}
      </Text>
    </View>
  );
}
