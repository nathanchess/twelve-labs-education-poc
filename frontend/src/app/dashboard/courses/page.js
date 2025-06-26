'use client';

import { useUser } from '../../context/UserContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

export default function Courses() {
  const { userRole, userName, isLoggedIn } = useUser();
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [s3Key, setS3Key] = useState(null);
  const [isButtonAnimating, setIsButtonAnimating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [s3UploadProgress, setS3UploadProgress] = useState(0);
  const [geminiUploadProgress, setGeminiUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [geminiFileId, setGeminiFileId] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  async function uploadToS3(file) {
    try {
      console.log('Uploading to S3 via API:', { fileName: file.name, fileSize: file.blob.size });

      // Use the API route instead of direct S3 upload
      const formData = new FormData();
      formData.append('file', file.blob);
      formData.append('userName', userName);

      const response = await fetch('/api/upload-s3', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'S3 upload failed');
      }

      const result = await response.json();
      
      if (!result.s3Key) {
        throw new Error('S3 upload succeeded but no key returned');
      }
      
      setS3Key(result.s3Key);
      console.log('S3 upload successful:', result.s3Key);

      return {
        name: file.name,
        size: file.blob.size,
        type: file.blob.type,
        date: new Date(),
        s3Key: result.s3Key
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw error;
    }
  }

  async function uploadToGemini(file) {
    try {
      console.log('Uploading to Gemini via API:', { fileName: file.name, fileSize: file.blob.size });

      // Use the API route for Gemini upload
      const formData = new FormData();
      formData.append('file', file.blob);
      formData.append('userName', userName);

      const response = await fetch('/api/upload-gemini', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gemini upload failed');
      }

      const result = await response.json();
      
      if (!result.geminiFileId) {
        throw new Error('Gemini upload succeeded but no file ID returned');
      }
      
      setGeminiFileId(result.geminiFileId);
      console.log('Gemini upload successful:', result.geminiFileId);

      return {
        name: file.name,
        size: file.blob.size,
        type: file.blob.type,
        date: new Date(),
        geminiFileId: result.geminiFileId
      };
    } catch (error) {
      console.error('Gemini upload error:', error);
      throw error;
    }
  }
   
  const handleUpload = (file) => {
    // Create a blob URL for the file
    const blob = new Blob([file], { type: file.type });
    const blobUrl = URL.createObjectURL(blob);
    
    // Store file data with blob for API upload
    const fileData = {
      name: file.name,
      size: file.size,
      type: file.type,
      date: new Date(),
      blob: blob,
      blobUrl: blobUrl,
    };
    
    console.log('File data:', fileData);
    
    // Set the single uploaded video
    setUploadedVideo(fileData);
  };

  const handleFileSelect = (event) => {
    console.log('File selected:', event.target.files);
    const file = event.target.files[0];
    if (file && file.type.startsWith('video/')) {
      handleUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const videoFile = files.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      handleUpload(videoFile);
      // Don't call uploadToS3 here - it will be handled by handleUploadVideos
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const uploadVideoIdToDynamoDB = async (twelveLabsVideoId, s3Key, geminiFileId) => {

    try {
      // Validate that we have the required values
      if (!twelveLabsVideoId) {
        throw new Error('TwelveLabs video ID is required');
      }

      // Create the request body with proper validation
      const requestBody = {
        twelve_labs_video_id: twelveLabsVideoId
      };

      // Only include s3_key if it's a valid string
      if (s3Key && typeof s3Key === 'string' && s3Key.trim() !== '') {
        requestBody.s3_key = s3Key;
      }

      // Only include gemini_file_id if it's a valid string
      if (geminiFileId && typeof geminiFileId === 'string' && geminiFileId.trim() !== '') {
        requestBody.gemini_file_id = geminiFileId;
      }

      console.log('Uploading to DynamoDB with:', requestBody);

      const uploadVideoResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload_video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!uploadVideoResponse.ok) {
        const errorData = await uploadVideoResponse.json();
        console.error('Backend API error:', errorData);
        throw new Error(`Backend API error: ${errorData.message || uploadVideoResponse.statusText}`);
      }

      const uploadResult = await uploadVideoResponse.json();
      console.log('Upload to DynamoDB successful:', uploadResult);

    } catch (error) {
      console.error('Error uploading to DynamoDB:', error);
      setUploadProgress(0);
      throw new Error(`Error uploading to DynamoDB: ${error.message}`);
    }


  }

  const uploadVideoToTwelveLabs = async (s3Result, geminiResult) => {
    
    if (!uploadedVideo) return;
    
    setIsButtonAnimating(true);
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Upload to TwelveLabs with progress tracking
      const url = 'https://api.twelvelabs.io/v1.3/tasks';

      const form = new FormData();
      form.append('index_id', process.env.NEXT_PUBLIC_TWELVE_LABS_INDEX_ID);
      form.append('video_file', uploadedVideo.blob, uploadedVideo.name);
      form.append('enable_video_stream', 'true');

      const options = {
        method: 'POST', 
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY
        },
        body: form
      }

      const response = await fetch(url, options);
      const data = await response.json();
      
      const retrieveVideoIndexTaskURL = 'https://api.twelvelabs.io/v1.3/tasks/' + data._id;
      const retrieveVideoIndexTaskOptions = {
        method: 'GET',
        headers: {
          'x-api-key': process.env.NEXT_PUBLIC_TWELVE_LABS_API_KEY
        }
      }

      while (true) {
        const retrieveVideoIndexTaskResponse = await fetch(retrieveVideoIndexTaskURL, retrieveVideoIndexTaskOptions);
        const retrieveVideoIndexTaskData = await retrieveVideoIndexTaskResponse.json();

        const status = retrieveVideoIndexTaskData.status;

        if (status == 'ready') {
          
          setUploadProgress(100);

          // Log the current state of our upload keys
          console.log('Upload keys before DynamoDB:', {
            twelveLabsVideoId: data.video_id,
            s3Key: s3Result?.s3Key,
            geminiFileId: geminiResult?.geminiFileId
          });

          // Upload to DynamoDB with both TwelveLabs video ID and S3 key
          await uploadVideoIdToDynamoDB(data.video_id, s3Result?.s3Key, geminiResult?.geminiFileId);

          break;
        } else if (status == 'validating') {
          setUploadProgress(5);
        } else if (status == 'queued') {
          setUploadProgress(10);
        } else if (status == 'pending') {
          setUploadProgress(20);
        } else if (status == 'indexing') {
          setUploadProgress(70);
        } else if (status == 'failed') {
          setUploadProgress(100);
          throw new Error('Video indexing failed');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

      }

      console.log('Video uploaded successfully:', data);
      setUploadProgress(100);
      setIsUploading(false);
      setIsButtonAnimating(false);
      
      // Store the video ID for future reference
      if (data.video_id) {
        console.log('Video ID:', data.video_id);
        
        // Store video data in localStorage for the slug route
        const videoDataForStorage = {
          ...uploadedVideo,
          twelveLabsVideoId: data.video_id,
          s3Key: s3Result?.s3Key, // Include S3 key in stored data
          geminiFileId: geminiResult?.geminiFileId, // Include Gemini file ID in stored data
          uploadDate: new Date().toISOString()
        };
        localStorage.setItem(`video_${data.video_id}`, JSON.stringify(videoDataForStorage));
        
        // Redirect to the video slug route
        router.push(`/dashboard/courses/${data.video_id}`);
      }

    } catch (error) {
      console.error('Error uploading to TwelveLabs:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setIsButtonAnimating(false);
    } finally {
      setIsUploading(false);
      setIsButtonAnimating(false);
    }
  }

  // Main upload function that handles S3, Gemini, and TwelveLabs uploads
  const handleUploadVideos = async () => {
    if (!uploadedVideo) return;
    
    setIsButtonAnimating(true);
    setIsUploading(true);
    setUploadProgress(0);
    setS3UploadProgress(0);
    setGeminiUploadProgress(0);
    setUploadStatus('Starting uploads...');
    
    try {
      console.log('Starting upload process for:', uploadedVideo.name);
      
      // Variables to store upload results
      let s3Result = null;
      let geminiResult = null;
      
      // First, upload to S3 and Gemini in parallel
      setUploadStatus('Uploading to S3 and Gemini...');
      
      const [s3UploadResult, geminiUploadResult] = await Promise.all([
        // S3 upload promise with progress tracking
        (async () => {
          setS3UploadProgress(10);
          try {
            const result = await uploadToS3(uploadedVideo);
            setS3UploadProgress(100);
            console.log('S3 upload completed:', result);
            return result;
          } catch (error) {
            console.error('S3 upload failed:', error);
            throw new Error(`S3 upload failed: ${error.message}`);
          }
        })(),
        
        // Gemini upload promise with progress tracking
        (async () => {
          setGeminiUploadProgress(10);
          try {
            const result = await uploadToGemini(uploadedVideo);
            setGeminiUploadProgress(100);
            console.log('Gemini upload completed:', result);
            return result;
          } catch (error) {
            console.error('Gemini upload failed:', error);
            throw new Error(`Gemini upload failed: ${error.message}`);
          }
        })()
      ]);
      
      // Store the results
      s3Result = s3UploadResult;
      geminiResult = geminiUploadResult;
      
      console.log('S3 and Gemini uploads completed. Results:', { s3Result, geminiResult });
      
      // Now upload to TwelveLabs with the results available
      setUploadStatus('Uploading to TwelveLabs...');
      await uploadVideoToTwelveLabs(s3Result, geminiResult);
      
      console.log('All uploads completed successfully');
      setUploadStatus('All uploads completed successfully!');
      
    } catch (error) {
      console.error('Upload process failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setS3UploadProgress(0);
      setGeminiUploadProgress(0);
      setIsButtonAnimating(false);
      setUploadStatus('Upload failed');
      
      // Show error to user
      alert(`Upload failed: ${error.message}`);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Course Management</h1>
            <p className="text-gray-600 mt-2">Upload and manage your lecture video</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>

        {/* Video Upload Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload Lecture Video</h2>
          
          {/* Upload Area */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer group ${
              isDragOver 
                ? 'border-blue-500 bg-blue-50 scale-105' 
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFileDialog}
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
              <div className="grid grid-cols-8 grid-rows-6 h-full">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div key={i} className="border border-gray-300"></div>
                ))}
              </div>
            </div>

            {/* Upload Icon */}
            <div className="relative z-10">
              <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <h3 className="text-xl font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                {isDragOver ? 'Drop your video here' : 'Click to upload or drag and drop'}
              </h3>
              
              <p className="text-gray-600 mb-4">
                {isDragOver 
                  ? 'Release to upload your lecture video' 
                  : 'Support for MP4, MOV, AVI, and other video formats'
                }
              </p>
              
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Maximum file size: 500MB</span>
              </div>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* Uploaded Video Display */}
        {uploadedVideo && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Uploaded Video</h2>
            
            {/* Video Preview */}
            <div className="mb-6">
              <video 
                src={uploadedVideo.blobUrl} 
                controls 
                className="w-full max-w-2xl mx-auto rounded-lg shadow-md"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
            
            {/* Video Information */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Video Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">File Name</p>
                  <p className="font-medium text-gray-800">{uploadedVideo.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">File Size</p>
                  <p className="font-medium text-gray-800">{(uploadedVideo.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">File Type</p>
                  <p className="font-medium text-gray-800">{uploadedVideo.type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Upload Date</p>
                  <p className="font-medium text-gray-800">{uploadedVideo.date.toLocaleDateString()}</p>
                </div>
              </div>
              
              {/* Blob Information */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Blob Information</p>
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-gray-700 font-mono break-all">
                    Blob URL: {uploadedVideo.blobUrl}
                  </p>
                  <p className="text-xs text-gray-700 font-mono mt-1">
                    Blob Size: {uploadedVideo.blob.size} bytes
                  </p>
                  <p className="text-xs text-gray-700 font-mono mt-1">
                    Blob Type: {uploadedVideo.blob.type}
                  </p>
                </div>
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="bg-blue-50 rounded-xl p-6 mb-6 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-blue-800">Uploading Video</h3>
                  <span className="text-sm font-medium text-blue-600">{uploadStatus}</span>
                </div>
                
                {/* S3 Upload Progress */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">S3 Upload</span>
                    <span className="text-sm text-blue-600">{s3UploadProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${s3UploadProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Gemini Upload Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">Gemini Processing</span>
                    <span className="text-sm text-blue-600">{geminiUploadProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${geminiUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* TwelveLabs Upload Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-700">TwelveLabs Processing</span>
                    <span className="text-sm text-blue-600">{uploadProgress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out shadow-sm"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Status Text */}
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>{uploadStatus}</span>
                </div>
              </div>
            )}

            {/* Upload Complete Message */}
            {!isUploading && uploadProgress === 100 && (
              <div className="bg-green-50 rounded-xl p-6 mb-6 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-800">Upload Complete!</h3>
                    <p className="text-sm text-green-600">Video successfully uploaded to TwelveLabs</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Upload Videos Button */}
            <div className="flex justify-center">
              <button
                onClick={handleUploadVideos}
                disabled={isButtonAnimating}
                className={`relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-75 disabled:cursor-not-allowed ${
                  isButtonAnimating ? 'animate-pulse' : ''
                }`}
              >
                {/* Button Content */}
                <div className="flex items-center gap-3">
                  {isButtonAnimating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing Video...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span>Process Video</span>
                    </>
                  )}
                </div>
                
                {/* Animated Background */}
                <div className={`absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-xl opacity-0 transition-opacity duration-300 ${
                  isButtonAnimating ? 'opacity-100 animate-pulse' : ''
                }`}></div>
                
                {/* Ripple Effect */}
                <div className={`absolute inset-0 rounded-xl bg-white opacity-20 transform scale-0 transition-transform duration-500 ${
                  isButtonAnimating ? 'scale-100' : ''
                }`}></div>
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!uploadedVideo && (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-32 h-32 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No video uploaded yet</h3>
            <p className="text-gray-600">Upload your lecture video to get started</p>
          </div>
        )}
      </div>
    </div>
  );
} 