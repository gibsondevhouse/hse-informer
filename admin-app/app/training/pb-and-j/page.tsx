import type { Metadata } from 'next';
import { CoursePlayer } from '@/components/lms/course-player';
import { pbjCourse } from '@/lib/lms/pbj-course';

export const metadata: Metadata = {
  title: 'PBJ-101 · Peanut Butter and Jelly | HSE Informer',
  description:
    'A guided PB&J practice course in the HSE Informer learning player. Progress is stored in this browser; no training record is created.',
};

export default function PeanutButterAndJellyPage() {
  return <CoursePlayer course={pbjCourse} />;
}
