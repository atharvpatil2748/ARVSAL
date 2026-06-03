import cv2
from yolo_detector import YOLODetector
from click_refiner import ClickRefiner

class Locator:

    def __init__(self):

        self.detector = YOLODetector()
        self.refiner = ClickRefiner()

    def locate(self, image_path, target):

        image = cv2.imread(image_path)

        elements = self.detector.detect(image)

        for el in elements:

            label = el["label"]

            if target in label or target == "send":

                bbox = el["bbox"]

                point = self.refiner.refine(bbox)

                return {
                    "label": label,
                    "bbox": bbox,
                    "clickable_point": point,
                    "confidence": el["confidence"]
                }

        return None