import type { Metadata } from 'next';
import { CoursePlayer } from '@/components/lms/course-player';
import { pbjComponentLabCourse } from '@/lib/lms/pbj-course';

export const metadata: Metadata = {
  title: 'PBJ-LAB · Component catalog | HSE Informer',
  description: 'Author lab for reviewing the learning player and its content blocks.',
};

export default function ComponentLabPage() {
  return <CoursePlayer course={pbjComponentLabCourse} authorMode />;
}
