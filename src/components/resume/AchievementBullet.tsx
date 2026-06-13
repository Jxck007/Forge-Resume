import React from 'react';
import { Text, View } from '@react-pdf/renderer';
import { ResumeAchievement } from '../../schema/resumeSchema';
import { ResumePrimitiveStyles } from './types';

interface AchievementBulletProps extends React.Attributes {
  key?: React.Key;
  achievement: ResumeAchievement;
  styles: ResumePrimitiveStyles;
}

export function AchievementBullet({ achievement, styles }: AchievementBulletProps) {
  return (
    <View style={styles.listItem} wrap={false}>
      <Text style={styles.bullet}>{'\u2022'}</Text>
      <Text style={styles.description}>
        {achievement.title ? `${achievement.title}: ` : ''}
        {achievement.description}
        {achievement.date ? ` | ${achievement.date}` : ''}
      </Text>
    </View>
  );
}
