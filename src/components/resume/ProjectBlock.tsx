import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { ResumeProject } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles, safePdfUrl } from './types';
import { ResumeData } from '../../types';

interface ProjectBlockProps extends React.Attributes {
  key?: React.Key;
  project: ResumeProject;
  linkDisplayMode: ResumeData['linkDisplayMode'];
  styles: ResumePrimitiveStyles;
  pagination: PaginationPolicy;
  emphasized?: boolean;
}

export function ProjectBlock({
  project,
  linkDisplayMode,
  styles,
  pagination,
  emphasized = false,
}: ProjectBlockProps) {
  const links = [
    project.links.github
      ? {
          label: linkDisplayMode === 'raw' ? safePdfUrl(project.links.github) : 'GitHub: Click here',
          url: safePdfUrl(project.links.github),
        }
      : null,
    project.links.demo
      ? {
          label: linkDisplayMode === 'raw' ? safePdfUrl(project.links.demo) : 'Live Demo: Click here',
          url: safePdfUrl(project.links.demo),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  return (
    <View
      style={emphasized ? styles.projectEntry : styles.entry}
      wrap
      minPresenceAhead={pagination.entry}
    >
      <View style={styles.entryTop} wrap={false}>
        <Text style={styles.entryTitle}>{project.title}</Text>
        {project.date ? <Text style={styles.date}>{project.date}</Text> : null}
      </View>
      {(project.tech.length > 0 || links.length > 0) ? (
        <View style={styles.entryDetailRow} wrap={false}>
          <Text style={styles.entryDetailMeta}>
            {project.tech.length > 0 ? `Tech: ${project.tech.join(', ')}` : ''}
          </Text>
          {links.length > 0 ? (
            <View style={styles.inlineLinks} wrap={false}>
              {links.map((link, index) => (
                <React.Fragment key={link.url}>
                  {index > 0 ? <Text style={styles.contactSeparator}>{'\u2022'}</Text> : null}
                  <Link src={link.url} style={styles.entryLink}>{link.label}</Link>
                </React.Fragment>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {project.description ? (
        <Text
          style={styles.description}
          orphans={pagination.orphans}
          widows={pagination.widows}
        >
          {project.description}
        </Text>
      ) : null}
    </View>
  );
}
