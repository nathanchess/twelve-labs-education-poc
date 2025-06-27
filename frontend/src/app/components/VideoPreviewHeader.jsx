import { useRouter } from 'next/navigation';

export default function VideoPreviewHeader({ videoData, videoId }) {

    const router = useRouter();

    return (
        <div className="bg-white shadow-sm border-b flex-shrink-0">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{videoData.name}</h1>
                <p className="text-gray-600 text-sm">Video ID: {videoId}</p>
              </div>
              <button
                onClick={() => router.push('/dashboard/courses')}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Courses
              </button>
            </div>
          </div>
        </div>
    )
}
