'use client';

import { useUser } from '../../../context/UserContext';
import React from 'react';
import { use } from 'react';
import InstructorCourseView from '../../../components/InstructorCourseView';


export default function VideoPage({ params }) {

  const { videoId } = use(params);
  const { userRole, userName, isLoggedIn } = useUser(); 

  if (true) {
    return <InstructorCourseView videoId={videoId} />
  } else {
    return <div>Student Course View</div>
  }

} 