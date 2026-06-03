import cv2

class UIDetector:

    def detect(self, image):

        # placeholder until YOLO added
        h, w = image.shape[:2]

        return [
            {
                "label": "composer",
                "bbox": {
                    "x": int(w*0.2),
                    "y": int(h*0.85),
                    "width": int(w*0.6),
                    "height": int(h*0.1)
                },
                "confidence": 0.8
            }
        ]