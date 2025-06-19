from providers import TwelveLabsHandler
import json

def upload_to_providers():

    pass

if __name__ == "__main__":

    twelve_labs_handler = TwelveLabsHandler(twelve_labs_video_id="6852f83538c2304f60ebcb3f")
    
    summaryStream, chapterStream = twelve_labs_handler.stream_student_lecture_analysis()

    print("--------------------------------")
    print("Student Lecture Analysis:")
    print("--------------------------------")

    print("Title: ", twelve_labs_handler.title)
    print("Hashtags: ", twelve_labs_handler.hashtags)
    print("Topics: ", twelve_labs_handler.topics)

    for string in summaryStream:
        pass

    print("--------------------------------")
    print(f"Aggregated Summary: {summaryStream.aggregated_text}")

    for string in chapterStream:
        pass

    print("--------------------------------")
    print(f"Aggregated Chapters: {json.dumps(chapterStream.aggregated_text, indent=4)}")