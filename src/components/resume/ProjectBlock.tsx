import React from 'react';
import { Link, Text, View } from '@react-pdf/renderer';
import { ResumeProject } from '../../schema/resumeSchema';
import { PaginationPolicy, ResumePrimitiveStyles } from './types';
import { LinkDisplayMode, ResumeData } from '../../types';
import { formatResumeLink, resolveLinkDisplayMode } from '../../utils/linkDisplay';

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
  const displayMode = resolveLinkDisplayMode({ linkDisplayMode });
  const links = [
    formatResumeLink({ href: project.links.github, kind: 'project-github' }, displayMode),
    formatResumeLink({ href: project.links.demo, kind: 'project-demo' }, displayMode),
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  return (
    <View
      style={emphasized ? styles.projectEntry : styles.entry}
      wrap
      minPresenceAhead={pagination.entry}
    >
      <View style={styles.projectHeader} wrap={false}>
        <Text style={styles.entryTitle}>{project.title}</Text>
        {(project.date || links.length > 0) ? (
          <View style={styles.projectHeaderMeta}>
            {project.date ? <Text style={styles.date}>{project.date}</Text> : null}
            {links.length > 0 ? (
              <View style={styles.projectLinks}>
                {links.map((link, index) => (
                  <View key={`${link.url}-${index}`} style={styles.projectLinkItem} wrap={false}>
                    {index > 0 ? <Text style={styles.contactSeparator}>{'\u2022 '}</Text> : null}
                    <Link src={link.url} style={styles.projectLink}>{link.label}</Link>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {project.tech.length > 0 ? (
        <Text style={styles.projectTech}>
          {project.tech.join(' • ')}
        </Text>
      ) : null}
      {project.description ? (
        <Text
          style={styles.projectDescription}
          orphans={pagination.orphans}
          widows={pagination.widows}
        >
          {project.description}
        </Text>
      ) : null}
    </View>
  );
}
