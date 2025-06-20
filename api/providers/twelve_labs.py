from twelvelabs import TwelveLabs

import os
from dotenv import load_dotenv

load_dotenv()

class TwelveLabsHandler:

    def __init__(self, twelve_labs_index_id: str = "", twelve_labs_video_id: str = ""):

        self.twelve_labs_client = TwelveLabs(api_key=os.getenv("TWELVE_LABS_API_KEY"))

        self.twelve_labs_index_id = twelve_labs_index_id
        self.twelve_labs_video_id = twelve_labs_video_id
        
        self.indexes = dict()

        # Prompts for the video deconstruction focused on student learning.
        self.summary_prompt = "Summarize the video in less than 5 sentences for a student."
        self.chapter_prompt = """
        Generate chapters that covers the detailed subtopics of the video that the instructor is teaching. 
        Make the chapter title and summary be helpful for a student to understand the topic being discussed.
        The chapter summary should break down the subtopic into easy to understand instructions, concepts, and more.
        Label each chapter with an approrpriate title with the topic being discussed and methodology while being concise.
        Each chapter should have a detailed start and end time.
        
        Response must be in JSON format. Do not include any preamble or postamble.
        """

        # Internal video attributes
        self.title = None
        self.hashtags = None
        self.topics = None

        print("Initialized TwelveLabsHandler for video: ", self.twelve_labs_video_id)

    def _list_indexes(self):

        """
        
        Lists all indexes on the TwelveLabs account and populates the indexes list.
        
        """
        
        indexes = self.twelve_labs_client.index.list()
        for index in indexes:
            self.indexes[index.name] = index

        return self.indexes
    
    def stream_student_lecture_analysis(self):

        """
        
        Deconstructs the video into a list of frames.
        
        """

        try:

            summaryStream = self.twelve_labs_client.analyze_stream(video_id=self.twelve_labs_video_id, prompt=self.summary_prompt)
            chapterStream = self.twelve_labs_client.analyze_stream(video_id=self.twelve_labs_video_id, prompt=self.chapter_prompt)

            return summaryStream, chapterStream

        except Exception as e:

            raise Exception(f"Error deconstructing video: {str(e)}")

    def generate_gist(self):

        """
        
        Generates a gist of the video.
        
        """

        try: 

            gist = self.twelve_labs_client.gist(video_id=self.twelve_labs_video_id, types=['topic', 'hashtag', 'title'])

            title, hashtags, topics = gist.title, gist.hashtags.root, gist.topics.root

            return {
                'title': title,
                'hashtags': hashtags,
                'topics': topics
            }

        except Exception as e:

            raise Exception(f"Error generating gist: {str(e)}")
    
__all__ = ["TwelveLabsHandler"]