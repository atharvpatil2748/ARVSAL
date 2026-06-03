import sys
import json
import cv2

from locator import Locator

locator = Locator()


# ================= DETECT =================

def detect(image_path):

    try:

        image = cv2.imread(image_path)

        if image is None:
            print(json.dumps({
                "success": False,
                "error": "image_not_loaded"
            }))
            return

        elements = locator.detector.detect(image)

        print(json.dumps({
            "success": True,
            "elements": elements
        }))

    except Exception as e:

        print(json.dumps({
            "success": False,
            "error": str(e)
        }))


# ================= LOCATE =================

def locate(image_path, target):

    try:

        result = locator.locate(image_path, target)

        if not result:

            print(json.dumps({
                "success": False,
                "error": "element_not_found"
            }))
            return

        print(json.dumps({
            "success": True,
            "element": result
        }))

    except Exception as e:

        print(json.dumps({
            "success": False,
            "error": str(e)
        }))


# ================= ACT =================

def act(payload_json):

    try:

        payload = json.loads(payload_json)

        action = payload.get("action")

        if action == "ping":

            print(json.dumps({
                "success": True,
                "message": "python_worker_alive"
            }))
            return

        print(json.dumps({
            "success": False,
            "error": "unknown_action"
        }))

    except Exception as e:

        print(json.dumps({
            "success": False,
            "error": str(e)
        }))


# ================= MAIN =================

if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(json.dumps({
            "success": False,
            "error": "missing_command"
        }))
        sys.exit(0)

    command = sys.argv[1]

    if command == "detect":

        if len(sys.argv) < 3:
            print(json.dumps({"success": False}))
            sys.exit(0)

        image_path = sys.argv[2]
        detect(image_path)

    elif command == "locate":

        if len(sys.argv) < 4:
            print(json.dumps({"success": False}))
            sys.exit(0)

        image_path = sys.argv[2]
        target = sys.argv[3]

        locate(image_path, target)

    elif command == "act":

        if len(sys.argv) < 3:
            print(json.dumps({"success": False}))
            sys.exit(0)

        payload = sys.argv[2]

        act(payload)

    else:

        print(json.dumps({
            "success": False,
            "error": "unknown_command"
        }))





# import sys
# import json
# from detector import detect_boxes
# from actions import click_bbox, click_point, type_text, press_key, scroll


# def run_detect(image_path):
#     elements = detect_boxes(image_path)
#     print(json.dumps({
#         "success": True,
#         "elements": elements
#     }))


# def run_act(payload_json):
#     try:
#         payload = json.loads(payload_json)
#     except:
#         print(json.dumps({"success": False, "error": "invalid json"}))
#         return

#     action = payload.get("action")

#     if action == "click_bbox":
#         result = click_bbox(payload["bbox"])

#     elif action == "click_point":
#         result = click_point(payload["x"], payload["y"])

#     elif action == "type":
#         result = type_text(payload["text"])

#     elif action == "keypress":
#         result = press_key(payload["key"])

#     elif action == "scroll":
#         result = scroll(payload.get("direction", "down"), payload.get("amount", 400))

#     else:
#         result = {"success": False, "error": "unknown action"}

#     print(json.dumps(result))


# if __name__ == "__main__":

#     if len(sys.argv) < 2:
#         print(json.dumps({"success": False, "error": "no mode"}))
#         sys.exit(0)

#     mode = sys.argv[1]

#     if mode == "detect":
#         run_detect(sys.argv[2])

#     elif mode == "act":
#         run_act(sys.argv[2])

#     else:
#         print(json.dumps({"success": False, "error": "invalid mode"}))