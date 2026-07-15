import React from 'react';
import { RecommendationUI } from './RecommendationUI';

interface Props {
  teacherId: string;
  students: any[];
}

export const ClassTaskRec: React.FC<Props> = ({ teacherId, students }) => {
  return <RecommendationUI teacherId={teacherId} students={students} type="task" />;
};
