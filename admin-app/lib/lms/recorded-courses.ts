import { pbjCourse } from './pbj-course.ts';
import type { Course } from './schema';

/**
 * A database approval is necessary but cannot create course content. A release
 * must also resolve to an immutable package shipped with this build before it
 * can be delivered or scored. PBJ is only a sandbox package for pilot workflow
 * validation; it is never safety training or workplace authorization.
 */
const packages: Readonly<Record<string, Course>> = {
  [`${pbjCourse.id}@${pbjCourse.version}`]: pbjCourse,
};

export function getRecordedCoursePackage(
  courseId: string,
  version: string,
): Course | null {
  return packages[`${courseId}@${version}`] ?? null;
}

export function isPracticePackage(courseId: string): boolean {
  return courseId === pbjCourse.id;
}
