"""Generate a tiny ONNX model returning no detections for line editor E2E.

Uses protobuf wire encoding to avoid a Python ONNX dependency.
Run: python3 e2e/fixtures/generate_line_editor_model.py
"""
from pathlib import Path
import struct


def varint(value):
    result = bytearray()
    while value > 127:
        result.append((value & 127) | 128)
        value >>= 7
    result.append(value)
    return bytes(result)


def integer(field, value):
    return varint(field << 3) + varint(value)


def message(field, value):
    if isinstance(value, str):
        value = value.encode()
    return varint((field << 3) | 2) + varint(len(value)) + value


def value_info(name, dimensions):
    shape = b"".join(message(1, integer(1, dim)) for dim in dimensions)
    tensor_type = integer(1, 1) + message(2, shape)  # FLOAT
    return message(1, name) + message(2, message(1, tensor_type))


# One end-to-end prediction [x1, y1, x2, y2, confidence, class], all zero.
tensor = b"".join(integer(1, dim) for dim in [1, 1, 6])
tensor += integer(2, 1) + message(8, "predictions")
tensor += message(9, struct.pack("<6f", *([0] * 6)))
node = message(1, "predictions") + message(2, "output") + message(4, "Identity")
graph = message(1, node) + message(2, "line-editor-no-detections")
graph += message(5, tensor)
graph += message(11, value_info("images", [1, 3, 640, 640]))
graph += message(12, value_info("output", [1, 1, 6]))
model = integer(1, 8) + message(7, graph) + message(8, integer(2, 13))
Path(__file__).with_name("line-editor.onnx").write_bytes(model)
