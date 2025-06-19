'use client';

import { useUser } from '../../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useEffect, use } from 'react';

export default function VideoPage({ params }) {
  const { userRole, userName, isLoggedIn } = useUser();
  const router = useRouter();
  const [videoData, setVideoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { videoId } = use(params);

  useEffect(() => {
    // For now, we'll get video data from localStorage
    // In a real app, you'd fetch this from your API
    const storedVideoData = localStorage.getItem(`video_${videoId}`);
    if (storedVideoData) {
      setVideoData(JSON.parse(storedVideoData));
    }
    setLoading(false);
  }, [videoId]);

  if (!isLoggedIn) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!videoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-32 h-32 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Video not found</h3>
            <p className="text-gray-600 mb-4">The video with ID {videoId} could not be found.</p>
            <button
              onClick={() => router.push('/dashboard/courses')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Back to Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Video Details</h1>
            <p className="text-gray-600 mt-2">Video ID: {videoId}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/courses')}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Courses
          </button>
        </div>

        {/* Video Preview */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Video Preview</h2>
          
          {videoData.blobUrl && (
            <div className="mb-6">
              <video 
                src={videoData.blobUrl} 
                controls 
                className="w-full max-w-2xl mx-auto rounded-lg shadow-md"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}
          
          {/* Video Information */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Video Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">File Name</p>
                <p className="font-medium text-gray-800">{videoData.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">File Size</p>
                <p className="font-medium text-gray-800">{(videoData.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">File Type</p>
                <p className="font-medium text-gray-800">{videoData.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Upload Date</p>
                <p className="font-medium text-gray-800">{new Date(videoData.date).toLocaleDateString()}</p>
              </div>
            </div>
            
            {/* TwelveLabs Video ID */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">TwelveLabs Video ID</p>
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-sm text-gray-700 font-mono break-all">
                  {videoId}
                </p>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          <div className="bg-green-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800">Upload Complete!</h3>
                <p className="text-sm text-green-600">Video successfully uploaded to TwelveLabs and is ready for processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 