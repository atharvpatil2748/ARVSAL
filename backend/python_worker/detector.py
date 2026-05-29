from PIL import Image
import numpy as np
from config import USE_YOLO

def detect_boxes(image_path):

    if USE_YOLO:
        return detect_yolo(image_path)

    return detect_simple(image_path)


def detect_simple(image_path):
    """
    VERY SIMPLE placeholder detection.
    Later replaced by YOLO.
    """

    img = Image.open(image_path)
    w, h = img.size

    # Example heuristic → bottom input area
    return [
        {
            "x": w*0.2,
            "y": h*0.8,
            "w": w*0.6,
            "h": h*0.12,
            "confidence": 0.5
        }
    ]


def detect_yolo(image_path):
    # future — no change required elsewhere
    return []