from ultralytics import YOLO
import cv2

class YOLODetector:

    def __init__(self):
        self.model = YOLO("models/yolo_ui.pt")

    def detect(self, image):

        results = self.model(image)

        elements = []

        for r in results:

            boxes = r.boxes

            if boxes is None:
                continue

            for box in boxes:

                x1, y1, x2, y2 = box.xyxy[0].tolist()

                bbox = {
                    "x": int(x1),
                    "y": int(y1),
                    "width": int(x2-x1),
                    "height": int(y2-y1)
                }

                elements.append({
                    "label": "ui_element",
                    "bbox": bbox,
                    "confidence": float(box.conf)
                })

        return elements