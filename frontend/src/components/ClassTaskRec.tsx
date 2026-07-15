import React from 'react';
import { RecommendationUI } from './RecommendationUI';

interface Props {
  teacherId: string;
  students: any[];
  selectedBookId?: string;
}

export const ClassTaskRec: React.FC<Props> = ({ teacherId, students, selectedBookId }) => {
  return <RecommendationUI teacherId={teacherId} students={students} type="task" selectedBookId={selectedBookId} />;
};
