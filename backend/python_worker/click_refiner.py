import cv2
import numpy as np

class ClickRefiner:

    def refine(self, image, bbox):

        x = bbox["x"]
        y = bbox["y"]
        w = bbox["width"]
        h = bbox["height"]

        crop = image[y:y+h, x:x+w]

        if crop.size == 0:
            return None

        # find center of crop
        cx = x + w//2
        cy = y + h//2

        return {
            "x": int(cx),
            "y": int(cy)
        }